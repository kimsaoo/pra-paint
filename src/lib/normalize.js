// 브랜드별 코드 정규화 규칙 — 도료관리_앱개발_인수인계.md 4번 섹션 그대로 포팅

/**
 * 타미야 코드 정규화: 첫 공백 앞까지만 코드로 인식, -0 → - 치환 (leading zero 제거)
 * "LP-5 (TS-29)" → { code1: "LP-5", code2: "TS-29" }
 * "X-01" → { code1: "X-1", code2: null }
 */
export function normalizeTamiyaCode(raw) {
  if (!raw) return { code1: null, code2: null };
  const str = String(raw).trim();
  const altMatch = str.match(/\(([^)]+)\)/);
  const mainRaw = str.split(/\s|\(/)[0].trim();
  const altRaw = altMatch ? altMatch[1].trim().split(/\s/)[0] : null;

  const stripLeadingZero = (code) => {
    if (!code) return null;
    return code.replace(/-0+(\d)/, '-$1');
  };

  return {
    code1: stripLeadingZero(mainRaw),
    code2: stripLeadingZero(altRaw),
  };
}

/**
 * Vallejo 정규화: "70.XXX 이름" 형식으로. 중간에 있던 3자리 진열대번호는 제거.
 * N접미사(New Formula)는 유지.
 * 예: "70.821 German Camouflage Beige" 그대로, "70.880N Khaki Grey" 그대로 유지.
 * 저장된 문자열 자체가 이미 "70.XXX[N] 이름" 형식이라 가정하고 코드/이름만 분리.
 */
export function parseVallejo(text) {
  if (!text) return { code: null, name: null };
  const m = String(text).trim().match(/^(\d{2}\.\d{3}N?)\s+(.*)$/);
  if (!m) return { code: null, name: text.trim() };
  return { code: m[1], name: m[2].trim() };
}

/**
 * MIG(AMMO) 정규화: "MIG-XXXX 이름" (하이픈+4자리 zero-pad), A.접두사 제거.
 * ATOM 서브라인: "ATOMxxxxx 이름" 그대로.
 * 피규어 라인: "MIG-Fxxx 이름" 그대로.
 */
export function parseMig(text) {
  if (!text) return { code: null, name: null, subline: 'standard' };
  let str = String(text).trim().replace(/^A\.\s*/, '');

  let m = str.match(/^(ATOM\d+)\s+(.*)$/i);
  if (m) return { code: m[1].toUpperCase(), name: m[2].trim(), subline: 'atom' };

  m = str.match(/^(MIG-F\d+)\s+(.*)$/i);
  if (m) return { code: m[1].toUpperCase(), name: m[2].trim(), subline: 'figure' };

  m = str.match(/^MIG-?0*(\d+)\s+(.*)$/i);
  if (m) {
    const padded = `MIG-${m[1].padStart(4, '0')}`;
    return { code: padded, name: m[2].trim(), subline: 'standard' };
  }

  return { code: null, name: str, subline: 'standard' };
}

/**
 * AK Interactive: 원본 표기 그대로 유지. 코드/이름만 분리해서 반환 (공백 유무는 원본 그대로 둠).
 */
export function parseAk(text) {
  if (!text) return { code: null, name: null };
  const m = String(text).trim().match(/^(AK\s?\d+)\s+(.*)$/i);
  if (!m) return { code: null, name: text.trim() };
  return { code: m[1].replace(/\s+/, ' ').trim(), name: m[2].trim() };
}

/**
 * 두 정규화된 코드 문자열이 같은 도료를 가리키는지 비교 (공백/대소문자 무시)
 */
export function codeEquals(a, b) {
  if (!a || !b) return false;
  const clean = (s) => String(s).toUpperCase().replace(/\s+/g, '');
  return clean(a) === clean(b);
}

/**
 * 범용 "코드 이름 (비고)" 분리기. 첫 공백 앞을 코드로, 괄호는 모두 비고로 뽑아냄.
 * 예: "X-09 Brown (유광)" → { code: "X-09", name: "Brown", note: "유광" }
 */
export function splitCodeNameNote(text) {
  if (!text) return { code: '', name: '', note: '' };
  const trimmed = String(text).trim();
  const firstSpace = trimmed.indexOf(' ');
  if (firstSpace === -1) return { code: trimmed, name: '', note: '' };
  const code = trimmed.slice(0, firstSpace);
  let rest = trimmed.slice(firstSpace + 1).trim();
  const notes = [];
  rest = rest
    .replace(/\(([^)]*)\)/g, (_, inner) => {
      notes.push(inner.trim());
      return '';
    })
    .replace(/\s+/g, ' ')
    .trim();
  return { code, name: rest, note: notes.join(', ') };
}

/** "Testors TE-1144 Gold" 처럼 제조사명이 코드 앞에 붙은 케이스 전용 파서 */
export function parseTestorItaleri(text) {
  let manufacturer = '기타';
  let rest = String(text).trim();
  if (/^testors?/i.test(rest)) {
    manufacturer = 'Testor';
    rest = rest.replace(/^testors?\s*/i, '');
  } else if (/^italeri/i.test(rest)) {
    manufacturer = 'Italeri';
    rest = rest.replace(/^italeri\s*/i, '');
  }
  return { manufacturer, ...splitCodeNameNote(rest) };
}

/** 타미야 코드 접두사로 도료 타입 추정 (LP=락커(병), TS=락커스프레이, X/XF=에나멜) */
export function guessTamiyaPaintType(code) {
  if (/^LP-/i.test(code)) return '락커(병)';
  if (/^TS-/i.test(code)) return '락커스프레이';
  if (/^X-|^XF-/i.test(code)) return '에나멜';
  return '기타';
}
