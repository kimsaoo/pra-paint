const GEMINI_MODEL = 'gemini-3.5-flash-lite';
const SEARCH_MODEL = 'gemini-3.5-flash'; // 구글 검색 그라운딩은 flash-lite보다 flash 계열에서 안정적으로 지원됨

/**
 * 429(RESOURCE_EXHAUSTED) 응답을 사용자가 이해하기 쉬운 메시지로 변환.
 * 무료 티어는 RPM(분당 요청수)·RPD(일일 요청수) 두 가지 한도가 있는데, 에러 바디의
 * quotaId/문구로 어느 쪽인지 대략 구분해서 안내한다. 구분이 안 되면 RPM 쪽(재시도로 해결 가능)으로 가정.
 */
function buildQuotaErrorMessage(errText, modelName) {
  const isDailyQuota = /PerDay|RPD|daily/i.test(errText);
  if (isDailyQuota) {
    return `Gemini API 일일 무료 할당량을 초과했습니다 (${modelName}). 무료 티어는 하루 요청 수 제한이 있어 태평양시간 자정에 초기화됩니다. 오늘은 이 기능 대신 직접 입력해주시고, 자주 한도에 걸리면 Google AI Studio에서 결제(유료 티어) 등록을 검토해보세요.`;
  }
  return `Gemini API 요청이 너무 잦아 잠시 제한되었습니다 (${modelName}, 분당 요청 한도). 30초~1분 정도 기다린 뒤 다시 시도해주세요.`;
}

/** 429 오류에 한해, 짧게 한 번만 재시도 (분당 한도는 수십 초 내 풀리는 경우가 많음) */
async function fetchWithRetry(url, body, { retryDelayMs = 4000 } = {}) {
  const doFetch = () =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  let res = await doFetch();
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, retryDelayMs));
    res = await doFetch();
  }
  return res;
}

const PROMPT = `이 이미지는 프라모델 설명서에 있는 도료 지정표(페인팅 가이드)입니다.
표/그림에 나온 각 도료 항목을 찾아서 JSON 배열로만 응답하세요. 설명 문장이나 마크다운 코드블록 없이, 순수 JSON 배열만 출력하세요.

각 항목 형식: {"manufacturer": "Tamiya", "code": "XF-1", "name": "Flat Black"}
- manufacturer: 표에 다른 브랜드가 특별히 표기되어 있지 않으면 "Tamiya"로 기본 설정
- code: 표에 적힌 도료 코드 그대로 (예: XF-1, X-14, LP-5, TS-26 등)
- name: 도료 색상명 (영문 표기가 있으면 영문 그대로 사용)

읽을 수 없거나 애매한 항목은 제외하세요. 반드시 JSON 배열만 출력하세요.`;

/**
 * 이미지(base64 JPEG)에서 도료 목록을 추출. 실패 시 에러 throw.
 */
export async function extractPaintsFromImage(base64Jpeg) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API 키가 설정되지 않았습니다. .env의 VITE_GEMINI_API_KEY를 확인해주세요.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const body = {
    contents: [
      {
        parts: [{ text: PROMPT }, { inline_data: { mime_type: 'image/jpeg', data: base64Jpeg } }],
      },
    ],
    generationConfig: { temperature: 0.1 },
  };

  const res = await fetchWithRetry(url, body);

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    if (res.status === 429) throw new Error(buildQuotaErrorMessage(errText, GEMINI_MODEL));
    throw new Error(`Gemini API 오류 (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const cleaned = text.replace(/```json|```/g, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('이미지에서 도료 목록을 읾어내지 못했습니다. 다른 사진으로 시도해주세요.');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('예상한 형식의 응답이 아닙니다.');
  }
  return parsed;
}

/** "1/35", "1:35", "35" 등에서 분모 숫자를 추출. 못 읽으면 null */
export function scaleDenominator(scale) {
  const m = String(scale || '').match(/(?:1\s*[/:]\s*)?(\d{1,4})\s*$/);
  const n = m ? Number(m[1]) : NaN;
  return n > 1 ? n : null;
}

/**
 * 킷 완성 크기(mm) 조사.
 * 1) 킷 자체 상품정보(Scalemates, 제조사, 판매처)에 완성 크기가 있으면 그 값을 사용
 * 2) 없으면 실물(차량, 전차, 바이크, 함선 등)의 전장/전폭/전고(m)를 검색해서
 *    앱 코드에서 직접 스케일로 나눠 계산 (계산을 AI에 맡기지 않음)
 * 반환: { length, width, height, source: 'kit'|'calculated', note, real, sources }
 */
export async function searchKitDimensions(manufacturer, kitName, scale) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API 키가 설정되지 않았습니다. .env의 VITE_GEMINI_API_KEY를 확인해주세요.');
  }
  if (!kitName?.trim()) throw new Error('품명을 먼저 입력해주세요.');
  const denom = scaleDenominator(scale);

  const prompt = `프라모델 킷 "${manufacturer || ''} ${kitName}" (스케일 ${scale || '미지정'})의 크기 정보를 웹에서 검색해줘.
1. 이 킷 자체의 완성 크기(mm)가 Scalemates, 제조사 공식 페이지, 판매처 상품 설명에 명시되어 있는지 찾아.
2. 이 킷이 재현하는 실물(차량, 전차, 오토바이, 함선, 항공기)의 실제 전장, 전폭, 전고를 미터 단위로 찾아. 킷 이름에 형식이나 버전이 있으면 그 형식 기준으로.
검색 결과에서 확인되지 않은 값은 반드시 null로 두고, 추측하거나 직접 계산하지 마.
반드시 아래 JSON 형식으로만 응답하고 다른 텍스트는 포함하지 마:
{"kit": {"length": mm숫자또는null, "width": mm숫자또는null, "height": mm숫자또는null},
 "real": {"name": "실물 명칭", "length": m숫자또는null, "width": m숫자또는null, "height": m숫자또는null},
 "note": "어디서 확인했는지 한 줄"}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${SEARCH_MODEL}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
    generationConfig: { temperature: 0.1 },
  };
  const res = await fetchWithRetry(url, body);
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    if (res.status === 429) throw new Error(buildQuotaErrorMessage(errText, SEARCH_MODEL));
    throw new Error(`Gemini API 오류 (${res.status}): ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  const cand = data?.candidates?.[0];
  const text = cand?.content?.parts?.map((p) => p.text).filter(Boolean).join('') || '';
  const match = text.replace(/```json|```/g, '').match(/\{[\s\S]*\}/);
  if (!match) throw new Error('크기 정보를 찾지 못했습니다. 직접 입력해주세요.');
  let parsed;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    throw new Error('응답 형식을 해석하지 못했습니다. 직접 입력해주세요.');
  }
  const sources = (cand?.groundingMetadata?.groundingChunks || [])
    .map((c) => c.web)
    .filter((w) => w?.uri)
    .slice(0, 5)
    .map((w) => ({ title: w.title || w.uri, uri: w.uri }));

  const num = (v) => (typeof v === 'number' && isFinite(v) && v > 0 ? v : null);
  const kit = parsed.kit || {};
  const real = parsed.real || {};
  const kitDims = { length: num(kit.length), width: num(kit.width), height: num(kit.height) };
  const realDims = { length: num(real.length), width: num(real.width), height: num(real.height) };
  const hasKit = Object.values(kitDims).some(Boolean);
  const hasReal = Object.values(realDims).some(Boolean);
  const toMm = (m) => (m && denom ? Math.round((m * 1000 * 10) / denom) / 10 : null);
  const LABEL = { length: '전장', width: '전폭', height: '전고' };

  if (!hasKit && !hasReal) throw new Error('킷 크기와 실물 크기를 모두 찾지 못했습니다. 직접 입력해주세요.');
  if (!hasKit && !denom) {
    throw new Error(
      `킷 크기는 찾지 못했고, 실물 크기(${real.name || '실물'})는 찾았지만 스케일이 없어 환산할 수 없습니다. 스케일을 먼저 입력해주세요.`,
    );
  }

  // 킷 상품정보 값을 우선 쓰고, 빠진 항목만 실물 크기 ÷ 스케일로 채움
  const out = {};
  const calcKeys = [];
  for (const k of ['length', 'width', 'height']) {
    if (kitDims[k]) out[k] = kitDims[k];
    else if (realDims[k] && denom) {
      out[k] = toMm(realDims[k]);
      calcKeys.push(k);
    } else out[k] = null;
  }
  const source = calcKeys.length === 0 ? 'kit' : hasKit ? 'mixed' : 'calculated';
  const calcNote = calcKeys.length
    ? `${real.name || '실물'} ${calcKeys.map((k) => `${LABEL[k]} ${realDims[k]}m`).join(', ')} ÷ ${denom}`
    : '';
  const note = [calcNote, parsed.note].filter(Boolean).join(', ');
  return { ...out, source, calcKeys, note, real, sources };
}

export async function searchKitInfo(manufacturer, query) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API 키가 설정되지 않았습니다. .env의 VITE_GEMINI_API_KEY를 확인해주세요.');
  }
  if (!query?.trim()) throw new Error('품번 또는 품명을 먼저 입력해주세요.');

  const prompt = `프라모델 키트 "${manufacturer || ''} ${query}"의 정보를 웹에서 검색해줘.
우선 scalemates.com의 해당 키트 페이지를 찾고, 없으면 제조사 공식 사이트나 판매처 상품 페이지를 사용해.
검색 결과에서 확인되는 값만 채우고, 확인되지 않는 값은 반드시 null로 둬. 추측하거나 일반 상식으로 채우지 마.
반드시 아래 JSON 형식으로만 응답하고 다른 텍스트는 포함하지 마:
{
  "name": "키트 공식 명칭(박스 표기, 영문 그대로)",
  "kitNumber": "제조사 품번 또는 null",
  "manufacturer": "제조사명 또는 null",
  "scale": "예: 1/35 또는 null",
  "productType": "AFV, AUTO, BIKE, SHIP, AERO 중 하나 또는 null (전차/장갑차/군용차량/자주포/트럭은 AFV)",
  "genreDetail": "한국어 분류 예: 2차대전 중형전차, 현용 3세대 MBT, 현용 소형전술차량, 슈퍼카, 경주용 바이크 또는 null",
  "country": "재현 대상의 운용국을 한국어로 예: 독일, 미국, 러시아, 이스라엘 또는 null",
  "figureIncluded": true 또는 false 또는 null,
  "figureNote": "포함된 피규어 설명(예: 전차병 2체) 또는 null",
  "dimensions": {"length": 숫자또는null, "width": 숫자또는null, "height": 숫자또는null},
  "releaseYear": 숫자 또는 null,
  "note": "어디서 확인했는지 한 줄"
}
dimensions는 완성 크기(mm)가 검색 결과에 명시된 경우에만 채워.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${SEARCH_MODEL}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
    generationConfig: { temperature: 0.1 },
  };
  const res = await fetchWithRetry(url, body);
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    if (res.status === 429) throw new Error(buildQuotaErrorMessage(errText, SEARCH_MODEL));
    throw new Error(`Gemini API 오류 (${res.status}): ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  const cand = data?.candidates?.[0];
  const text = cand?.content?.parts?.map((p) => p.text).filter(Boolean).join('') || '';
  const match = text.replace(/```json|```/g, '').match(/\{[\s\S]*\}/);
  if (!match) throw new Error('키트 정보를 찾지 못했습니다. 품번이나 품명을 바꿔서 다시 시도해주세요.');
  let fields;
  try {
    fields = JSON.parse(match[0]);
  } catch {
    throw new Error('응답 형식을 해석하지 못했습니다. 다시 시도해주세요.');
  }
  const sources = (cand?.groundingMetadata?.groundingChunks || [])
    .map((c) => c.web)
    .filter((w) => w?.uri)
    .slice(0, 5)
    .map((w) => ({ title: w.title || w.uri, uri: w.uri }));
  return { fields, sources };
}
