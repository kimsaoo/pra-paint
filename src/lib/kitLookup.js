/**
 * 키트 정보 / 크기 자동 조회
 *
 * 방식: Tavily 검색 API(무료 월 1,000 크레딧)로 웹 페이지를 찾고,
 *       Gemini Flash-Lite(무료 등급, 검색 도구 없이)가 검색 결과 본문만 근거로 JSON을 정리한다.
 *       Gemini 3 계열의 Google 검색 기반 조회가 무료 등급에서 막혀(429, 한도 0) 이 방식으로 전환.
 *
 * VITE_TAVILY_API_KEY가 없으면 이전 방식(Gemini 검색 기반 조회)으로 동작한다.
 */
import {
  fetchWithRetry,
  buildQuotaErrorMessage,
  combineDims,
  scaleDenominator,
  searchKitInfoGrounded,
  searchKitDimensionsGrounded,
} from './gemini';

// 정리용 모델 (무료 등급). 첫 모델이 과부하(503)면 다음 모델로 전환
const EXTRACT_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];
const TAVILY_URL = 'https://api.tavily.com/search';

export const usingTavily = () => !!import.meta.env.VITE_TAVILY_API_KEY;

/** Tavily 검색. 반환: [{ title, url, content }] */
export async function tavilySearch(query, { maxResults = 5 } = {}) {
  const key = import.meta.env.VITE_TAVILY_API_KEY;
  if (!key) throw new Error('Tavily API 키가 설정되지 않았습니다. .env와 GitHub Secrets의 VITE_TAVILY_API_KEY를 확인해주세요.');
  let res;
  try {
    res = await fetch(TAVILY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        query,
        search_depth: 'basic', // 1 크레딧
        max_results: maxResults,
        include_answer: false,
        include_raw_content: true, // 짧은 요약만으로는 정보가 빠지는 경우가 많아 본문 포함
      }),
    });
  } catch (err) {
    console.error('[Tavily] 요청 실패', err);
    throw new Error(
      'Tavily 검색 서버에 연결하지 못했습니다. 인터넷 연결을 확인하고, 계속되면 브라우저에서 직접 호출이 막힌 것(CORS)일 수 있습니다. F12 Console의 [Tavily] 줄을 알려주세요.',
    );
  }
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    console.error(`[Tavily] ${res.status}`, t);
    if (res.status === 401) throw new Error('Tavily API 키가 올바르지 않습니다. 키를 다시 확인해주세요.');
    if (res.status === 429) throw new Error('Tavily 검색 요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.');
    if (res.status === 432 || res.status === 433)
      throw new Error('Tavily 이번 달 무료 크레딧(1,000)을 모두 썼습니다. 다음 달 1일에 초기화됩니다.');
    throw new Error(`Tavily 검색 오류 (${res.status}). F12 Console의 [Tavily] 줄을 확인해주세요.`);
  }
  const data = await res.json();
  const results = (data.results || []).map((r) => ({
    title: r.title || r.url,
    url: r.url,
    content: r.content || '',
    raw: typeof r.raw_content === 'string' ? r.raw_content : '',
  }));
  console.info(`[Tavily] "${query}" → ${results.length}건`, results.map((r) => r.title));
  return results;
}

/** 검색 결과를 Gemini에 넘길 텍스트로 변환 */
function resultsToContext(results) {
  return results
    .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n요약: ${r.content.slice(0, 800)}\n본문: ${r.raw.slice(0, 3500)}`)
    .join('\n\n');
}

/** Gemini Flash-Lite로 JSON 추출 (검색 도구 없음) */
async function extractJson(prompt) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini API 키가 설정되지 않았습니다. .env의 VITE_GEMINI_API_KEY를 확인해주세요.');
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
  };
  let res;
  let model;
  for (model of EXTRACT_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    res = await fetchWithRetry(url, body);
    // 과부하(503, 500)나 모델 없음(404)이면 다음 모델로
    if (![503, 500, 404].includes(res.status)) break;
    console.warn(`[Gemini] ${model} ${res.status}, 다음 모델로 전환`);
  }
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error(`[Gemini] ${model} ${res.status}`, errText);
    if (res.status === 429) throw new Error(buildQuotaErrorMessage(errText, model));
    if (res.status === 503 || res.status === 500)
      throw new Error('Gemini 서버가 지금 붐벼서 응답하지 못했습니다(일시적). 1~2분 뒤 다시 시도해주세요. 검색 크레딧은 이미 사용되었습니다.');
    throw new Error(`Gemini API 오류 (${res.status}). F12 Console의 [Gemini] 줄을 확인해주세요.`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('') || '';
  const match = text.replace(/```json|```/g, '').match(/\{[\s\S]*\}/);
  if (!match) throw new Error('검색 결과를 정리하지 못했습니다. 다시 시도해주세요.');
  try {
    const parsed = JSON.parse(match[0]);
    console.info(`[Gemini] ${model} 정리 결과`, parsed);
    return parsed;
  } catch {
    throw new Error('응답 형식을 해석하지 못했습니다. 다시 시도해주세요.');
  }
}

const RULE = `아래 [검색 결과]에 실제로 적힌 내용만 근거로 답해. 검색 결과에 없는 값은 반드시 null로 두고, 일반 상식이나 추측으로 채우지 마.
반드시 JSON 객체 하나만 출력해.`;

/** 키트 정보 조회. 반환: { fields, sources } (기존 searchKitInfo와 같은 형태) */
export async function searchKitInfo(manufacturer, query) {
  if (!usingTavily()) return searchKitInfoGrounded(manufacturer, query);
  if (!query?.trim()) throw new Error('품번 또는 품명을 먼저 입력해주세요.');

  const results = await tavilySearch(`scalemates ${manufacturer || ''} ${query} model kit`.trim(), { maxResults: 6 });
  if (results.length === 0) throw new Error('검색 결과가 없습니다. 품번이나 품명을 바꿔서 다시 시도해주세요.');

  const fields = await extractJson(`프라모델 키트 "${manufacturer || ''} ${query}"의 정보를 정리해줘.
${RULE}
형식:
{
  "name": "키트 공식 명칭(박스 표기, 영문 그대로)",
  "kitNumber": "제조사 품번 또는 null",
  "manufacturer": "제조사명 또는 null",
  "scale": "예: 1/35 또는 null",
  "productType": "AFV, AUTO, BIKE, SHIP, AERO 중 하나 또는 null (전차, 장갑차, 군용차량, 자주포, 트럭은 AFV)",
  "genreDetail": "한국어 분류 예: 2차대전 중형전차, 현용 3세대 MBT, 현용 소형전술차량, 슈퍼카, 경주용 바이크 또는 null",
  "country": "재현 대상의 운용국을 한국어로 예: 독일, 미국, 러시아, 이스라엘 또는 null",
  "figureIncluded": true 또는 false 또는 null,
  "figureNote": "포함된 피규어 설명 또는 null",
  "dimensions": {"length": mm숫자또는null, "width": mm숫자또는null, "height": mm숫자또는null},
  "releaseYear": 숫자 또는 null,
  "note": "어느 검색 결과([번호])에서 확인했는지 한 줄"
}
dimensions는 완성 크기(mm)가 검색 결과에 명시된 경우에만 채워.

[검색 결과]
${resultsToContext(results)}`);

  return { fields, sources: results.slice(0, 5).map((r) => ({ title: r.title, uri: r.url })) };
}

/**
 * 크기 조회: ① 킷 완성 크기 검색 → ② 없거나 일부 빠지면 실물 제원 검색 → 앱에서 스케일 환산
 * 반환 형태는 기존 searchKitDimensions와 같음
 */
export async function searchKitDimensions(manufacturer, kitName, scale) {
  if (!usingTavily()) return searchKitDimensionsGrounded(manufacturer, kitName, scale);
  if (!kitName?.trim()) throw new Error('품명을 먼저 입력해주세요.');

  // ① 킷 자체 크기 + 실물 명칭
  const scaleInName = scale && kitName.replace(/\s/g, '').includes(String(scale).replace(/\s/g, ''));
  const r1 = await tavilySearch(`${manufacturer || ''} ${kitName} ${scaleInName ? '' : scale || ''} model kit length width mm`.replace(/\s+/g, ' ').trim(), { maxResults: 5 });
  const p1 = r1.length
    ? await extractJson(`프라모델 키트 "${manufacturer || ''} ${kitName}" (스케일 ${scale || '미지정'})의 크기 정보를 정리해줘.
${RULE}
형식:
{"kit": {"length": 완성크기mm또는null, "width": mm또는null, "height": mm또는null},
 "real": {"name": "이 키트가 재현하는 실물의 영문 명칭과 형식(예: Tiger I Ausf.E). 키트 이름에서 알 수 있으면 채워", "length": null, "width": null, "height": null},
 "note": "어느 검색 결과([번호])에서 확인했는지 한 줄"}

[검색 결과]
${resultsToContext(r1)}`)
    : { kit: {}, real: {} };

  let parsed = p1;
  let sources = r1.slice(0, 3).map((r) => ({ title: r.title, uri: r.url }));
  const kit = p1.kit || {};
  const missing = ['length', 'width', 'height'].some((k) => !(typeof kit[k] === 'number' && kit[k] > 0));

  // ② 빠진 항목이 있고 스케일이 있으면 실물 제원 검색
  if (missing && scaleDenominator(scale)) {
    const realName = p1.real?.name || kitName.replace(/1\s*[/:]\s*\d+/g, '').trim();
    const r2 = await tavilySearch(`${realName} dimensions length width height specifications`, { maxResults: 5 });
    if (r2.length) {
      const p2 = await extractJson(`"${realName}" 실물(차량, 전차, 오토바이, 함선, 항공기)의 제원을 정리해줘.
${RULE}
형식:
{"name": "실물 명칭", "length": 전장m숫자또는null, "width": 전폭m숫자또는null, "height": 전고m숫자또는null,
 "note": "어느 검색 결과([번호])에서 확인했는지 한 줄"}
단위가 mm나 ft로 적혀 있으면 m로 바꿔서 숫자만 넣어. 포신을 포함한 길이와 차체 길이가 함께 있으면 포신 포함 길이를 써.

[검색 결과]
${resultsToContext(r2)}`);
      parsed = {
        kit,
        real: { name: p2.name || realName, length: p2.length, width: p2.width, height: p2.height },
        note: [p1.note, p2.note].filter(Boolean).join(', '),
      };
      sources = [...sources, ...r2.slice(0, 3).map((r) => ({ title: r.title, uri: r.url }))];
    }
  }
  return combineDims(parsed, scale, sources);
}

/** 검색 연결 시험: Tavily 직접 호출이 브라우저에서 되는지 확인 (1 크레딧 사용) */
export async function testSearchConnection() {
  if (!usingTavily()) return 'Tavily 키가 설정되지 않아 이전 방식(Gemini 검색 기반 조회)을 사용 중입니다.';
  const results = await tavilySearch('Tamiya 35216 Tiger I scalemates', { maxResults: 3 });
  return `연결 성공: 검색 결과 ${results.length}건 (예: ${results[0]?.title || '없음'})`;
}
