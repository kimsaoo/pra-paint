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

/** 색상 단어별 근사 HEX 값 (참고용 — 실제 도료 색과 다를 수 있음) */
const COLOR_HEX = {
  black: '#1c1c1c', white: '#f2f0e8', red: '#b3352b', orange: '#c9702e',
  yellow: '#d8b02c', green: '#4f7942', blue: '#3b6fa0', purple: '#6b4c8a',
  silver: '#b6b6b6', gold: '#bd9a3d', gray: '#8a8a86', grey: '#8a8a86',
  brown: '#6b4a30', tan: '#b89b72', buff: '#c2a878', pink: '#c98a9c',
  copper: '#a5643f', steel: '#75797c', smoke: '#5c5c5a', khaki: '#8b7d4b',
  olive: '#69692f', beige: '#d3c3a0', cream: '#eee2c8', ivory: '#efe9d8',
  violet: '#6a4fa0', maroon: '#701c1c', navy: '#22314f', aluminum: '#c6c6c6',
  aluminium: '#c6c6c6', rust: '#8a4a2a', sand: '#c2b280', earth: '#5f4c34',
  clear: '#d9e2e0',
};

function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s, l];
}

function hslToHex(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

const SHADE_LIGHTNESS_DELTA = {
  light: 0.16, pale: 0.22, bright: 0.08,
  dark: -0.16, deep: -0.2, burnt: -0.12, medium: 0,
};

/**
 * 색상명 텍스트에서 근사 HEX 색상을 추정 (참고용, 실제 도료 색과 다를 수 있음).
 * 색상 단어가 없으면 null 반환.
 */
export function approximateColorFromName(name) {
  const { colors, shades } = extractColorTokens(name);
  if (colors.length === 0) return null;

  const base = COLOR_HEX[colors[0]];
  if (!base) return null;

  let [h, s, l] = hexToHsl(base);
  for (const shade of shades) {
    const delta = SHADE_LIGHTNESS_DELTA[shade] || 0;
    l = Math.min(0.95, Math.max(0.05, l + delta));
  }
  return hslToHex(h, s, l);
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
