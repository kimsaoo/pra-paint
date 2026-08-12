const GEMINI_MODEL = 'gemini-3.5-flash-lite';

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

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
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
