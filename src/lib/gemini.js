const GEMINI_MODEL = 'gemini-3.5-flash-lite';
const SEARCH_MODEL = 'gemini-3.5-flash'; // 구글 검색 그라운딩은 flash-lite보다 flash 계열에서 안정적으로 지원됨

/** 429 응답 본문에서 한도 위반 정보를 꺼냄 (quotaMetric, quotaId, quotaValue) */
function parseQuotaViolations(errText) {
  try {
    const j = JSON.parse(errText);
    return (j.error?.details || []).flatMap((d) => d.violations || []);
  } catch {
    return [];
  }
}

/**
 * 429(RESOURCE_EXHAUSTED) 원인 분류
 * - unsupported: 한도가 0 = 현재 등급(무료)에서 쓸 수 없는 기능. 대표적으로 Gemini 3.x의 Google 검색 기반 조회
 * - daily: 일일 한도 초과
 * - minute: 분당 한도 초과 (잠시 후 재시도로 해결)
 * - unknown: 판별 불가
 */
function classifyQuotaError(errText) {
  const v = parseQuotaViolations(errText);
  const blob = `${errText} ${JSON.stringify(v)}`;
  if (/limit:\s*0\b/i.test(blob) || v.some((x) => String(x.quotaValue) === '0')) return 'unsupported';
  if (/PerDay|RPD|daily/i.test(blob)) return 'daily';
  if (/PerMinute|RPM|minute/i.test(blob)) return 'minute';
  return 'unknown';
}

export function buildQuotaErrorMessage(errText, modelName, { grounding = false } = {}) {
  console.error(`[Gemini 429] ${modelName}${grounding ? ' (검색 기반 조회)' : ''}`, errText);
  const kind = classifyQuotaError(errText);
  const tail = ' (원문은 F12 개발자도구 Console에서 확인할 수 있습니다)';
  if (kind === 'unsupported' || (grounding && kind === 'unknown')) {
    return `현재 Gemini API 키의 등급에서는 ${grounding ? 'Google 검색 기반 조회를' : '이 기능을'} 사용할 수 없습니다 (${modelName}, 허용 한도 0). 무료 등급에서는 Gemini 3 계열의 검색 기반 조회가 제공되지 않는 것으로 보입니다. Google AI Studio에서 결제를 연결하거나, 검색 없이 직접 입력해주세요.${tail}`;
  }
  if (kind === 'daily') {
    return `Gemini API 일일 무료 할당량을 초과했습니다 (${modelName}). 태평양시간 자정(한국시간 오후 4~5시)에 초기화됩니다. 오늘은 직접 입력해주세요.${tail}`;
  }
  if (kind === 'minute') {
    return `Gemini API 요청이 너무 잦아 잠시 제한되었습니다 (${modelName}, 분당 요청 한도). 30초~1분 정도 기다린 뒤 다시 시도해주세요.${tail}`;
  }
  return `Gemini API 사용 한도에 걸렸습니다 (${modelName}). 잠시 후 다시 시도하고, 계속되면 Google AI Studio의 사용량 화면을 확인해주세요.${tail}`;
}

/** 429 오류 중 분당 한도일 때만 한 번 재시도 (한도 0이나 일일 한도는 재시도해도 소용없으므로 바로 반환) */
export async function fetchWithRetry(url, body, { retryDelayMs = 4000 } = {}) {
  const doFetch = () =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  let res = await doFetch();
  if (res.status === 429) {
    const text = await res.text().catch(() => '');
    if (classifyQuotaError(text) !== 'minute') return new Response(text, { status: 429 });
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

/**
 * 크기 조사 결과 조합: 킷 상품정보 값 우선, 빠진 항목은 실물 크기(m) ÷ 스케일로 앱에서 직접 계산
 * parsed: { kit: {length,width,height}(mm), real: {name,length,width,height}(m), note }
 */
export function combineDims(parsed, scale, sources = []) {
  const denom = scaleDenominator(scale);
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
export async function searchKitDimensionsGrounded(manufacturer, kitName, scale) {
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
    if (res.status === 429) throw new Error(buildQuotaErrorMessage(errText, SEARCH_MODEL, { grounding: true }));
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

  return combineDims(parsed, scale, sources);
}

export async function searchKitInfoGrounded(manufacturer, query) {
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
    if (res.status === 429) throw new Error(buildQuotaErrorMessage(errText, SEARCH_MODEL, { grounding: true }));
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
