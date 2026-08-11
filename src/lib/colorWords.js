// 색상 매칭용 단어 목록 — 도료관리_앱개발_인수인계.md 3번 섹션 ④ 예시 그대로 확장

export const COLOR_WORDS = [
  'black', 'white', 'red', 'orange', 'yellow', 'green', 'blue', 'purple',
  'silver', 'gold', 'gray', 'grey', 'brown', 'tan', 'buff', 'pink',
  'copper', 'steel', 'smoke', 'khaki', 'olive', 'beige', 'cream', 'ivory',
  'violet', 'maroon', 'navy', 'aluminum', 'aluminium', 'rust', 'sand',
  'earth', 'clear', // clear는 finish로도 쓰이지만 "clear red"처럼 색을 수반할 때도 있어 후보 취급
];

// 매칭 시 제거 대상 (색 자체보다 마감/질감을 나타내는 단어)
// 주의: light/dark/medium 등은 색조를 바꾸는 수식어라 완전히 버리면 손실이 있음 —
// 문서에 명시된 한계 그대로 유지 (완벽하지 않음), 다만 FINISH_WORDS에서는 제외하지 않고
// 별도의 SHADE_WORDS로 분리해 "겹치면 가중치만 낮게" 주는 정도로 처리.
export const FINISH_WORDS = [
  'flat', 'semi-gloss', 'semigloss', 'gloss', 'glossy', 'matt', 'matte',
  'satin', 'metallic', 'mica', 'titanium', 'chrome', 'pearl', 'crystal',
  'fs', 'spray', 'intense', 'new', 'formula',
];

// 색조를 바꾸지만 완전히 다른 색은 아닌 수식어 — exact 매칭에는 포함, score 매칭엔 가중치 낮음
export const SHADE_WORDS = ['light', 'dark', 'medium', 'deep', 'pale', 'bright', 'burnt'];

const STOPWORDS = new Set([
  'the', 'a', 'and', 'of', 'for', 'with', '-', '(', ')',
]);

export function tokenize(name) {
  if (!name) return [];
  return String(name)
    .toLowerCase()
    .replace(/[()]/g, ' ')
    .split(/[\s/,-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !STOPWORDS.has(t));
}

/** 색상 단어만 추출 (finish 단어 제거), shade 단어는 별도 리스트로 반환 */
export function extractColorTokens(name) {
  const tokens = tokenize(name);
  const finishSet = new Set(FINISH_WORDS);
  const colorSet = new Set(COLOR_WORDS);
  const shadeSet = new Set(SHADE_WORDS);

  const colors = [];
  const shades = [];
  for (const t of tokens) {
    if (finishSet.has(t)) continue;
    if (colorSet.has(t)) colors.push(t);
    else if (shadeSet.has(t)) shades.push(t);
  }
  return { colors, shades, all: tokens.filter((t) => !finishSet.has(t)) };
}
