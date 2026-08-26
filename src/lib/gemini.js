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

/**
 * 킷의 완성 후 크기(가로/길이/높이, mm)를 조사.
 * 1) 킷 자체 상품정보에 크기가 있으면 그걸 사용
 * 2) 없으면 실제 차량/바이크/함선의 실물 크기를 찾아 스케일로 나눠서 계산
 * 구글 검색 그라운딩을 사용하므로 결과가 100% 정확하지 않을 수 있음 - 사용자가 확인 후 저장 권장.
 */
export async function searchKitDimensions(manufacturer, kitName, scale) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API 키가 설정되지 않았습니다. .env의 VITE_GEMINI_API_KEY를 확인해주세요.');
  }
  if (!kitName?.trim()) {
    throw new Error('제품명을 먼저 입력해주세요.');
  }

  const prompt = `"${manufacturer || ''} ${kitName}" (스케일 ${scale || '미지정'}) 프라모델 킷의 완성 후 크기(가로/길이/높이, mm)를 알려줘.
1. 먼저 이 킷 자체의 박스/상품 설명에 완성품 크기(mm)가 명시되어 있는지 검색해.
2. 못 찾으면, 이 킷이 재현하는 실제 차량/오토바이/함선/기갑차량의 실물 크기(전장/전폭/전고, 미터)를 검색하고, 스케일 ${scale}로 나눠서 mm 단위로 계산해.
반드시 아래 JSON 형식으로만 응답하고 다른 텍스트는 포함하지 마:
{"width": 숫자또는null, "length": 숫자또는null, "height": 숫자또는null, "source": "kit 또는 calculated", "note": "간단한 근거"}`;

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
  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((p) => p.text)
      .filter(Boolean)
      .join('') || '';
  const match = text.replace(/```json|```/g, '').match(/\{[\s\S]*\}/);
  if (!match) throw new Error('크기 정보를 찾지 못했습니다. 직접 입력해주세요.');

  let parsed;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    throw new Error('응답 형식을 해석하지 못했습니다. 직접 입력해주세요.');
  }
  return parsed;
}
