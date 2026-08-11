import { normalizeTamiyaCode, parseVallejo, parseMig, parseAk, codeEquals } from './normalize';
import { extractColorTokens } from './colorWords';

/**
 * ⚠️ 원본 엑셀 스펙과 달라진 부분 (설계 결정, 사용자 확인 필요할 수 있음):
 * 원본은 K/L/M열 문자열 "코드+이름"이 보유목록에 정확히 일치(COUNTIF)하는지로 보유 판정.
 * 앱에서는 이름 표기가 브랜드마다 갈려서(예: "70.951 White" vs "70.951 Flat White")
 * 문자열 완전일치 대신 "코드"만 파싱해서 비교하도록 바꿈. 실제 보유 판정 정확도는
 * 이쪽이 더 안정적이라고 판단했으나, 이름까지 다른 도료(코드 오탈자 등)를 걸러내지
 * 못할 수 있어 미검증 코드 관리 화면에서 재확인 가능하게 함.
 */

// ① 타미야 자체 보유 체크
export function isTamiyaSelfOwned(item, ownedOtherBrand) {
  const { code1, code2 } = normalizeTamiyaCode(item.code);
  if (!code1 && !code2) return false;

  const candidates = ownedOtherBrand.filter(
    (o) => o.brand === 'tamiya_enamel_lacquer' || o.brand === 'tamiya_ts_lp'
  );

  for (const o of candidates) {
    const ownedCode = normalizeTamiyaCode(o.text).code1;
    if (codeEquals(ownedCode, code1) || codeEquals(ownedCode, code2)) return true;
  }
  return false;
}

const BRAND_PARSERS = { vallejo: parseVallejo, mig: parseMig, ak: parseAk };

// ② 브랜드별 유사색 코드가 실제 보유 목록에 있는지
export function isBrandSimilarOwned(similarText, brand, ownedAcrylic) {
  if (!similarText) return false;
  const parse = BRAND_PARSERS[brand];
  const target = parse(similarText).code;
  if (!target) return false;

  const owned = ownedAcrylic.filter((o) => o.brand === brand);
  for (const o of owned) {
    const ownedCode = parse(o.text).code;
    if (codeEquals(ownedCode, target)) return true;
  }
  return false;
}

// ③ 보유여부 종합
export function computeOwnedFlags(item, ownedOtherBrand, ownedAcrylic) {
  const tamiyaOwned = isTamiyaSelfOwned(item, ownedOtherBrand);
  const vallejoOwned = isBrandSimilarOwned(item.vallejoSimilar, 'vallejo', ownedAcrylic);
  const migOwned = isBrandSimilarOwned(item.migSimilar, 'mig', ownedAcrylic);
  const akOwned = isBrandSimilarOwned(item.akSimilar, 'ak', ownedAcrylic);
  const owned = tamiyaOwned || vallejoOwned || migOwned || akOwned;
  return {
    tamiyaOwned,
    vallejoOwned,
    migOwned,
    akOwned,
    ownedStatus: owned ? '보유' : '미보유',
  };
}

// ④ 추가 유사색 탐색 (색상명 텍스트 매칭)
export function findAdditionalSimilar(item, ownedAcrylic, maxResults = 2) {
  const { colors: itemColors, all: itemAll } = extractColorTokens(item.colorName);
  if (itemColors.length === 0) return [];

  const excludeCodes = new Set(
    ['vallejo', 'mig', 'ak']
      .map((b) => {
        const parse = BRAND_PARSERS[b];
        return parse(item[`${b === 'vallejo' ? 'vallejoSimilar' : b === 'mig' ? 'migSimilar' : 'akSimilar'}`]).code;
      })
      .filter(Boolean)
      .map((c) => String(c).toUpperCase().replace(/\s+/g, ''))
  );

  const scored = [];
  for (const o of ownedAcrylic) {
    const parse = BRAND_PARSERS[o.brand];
    const { code, name } = parse(o.text);
    if (!code) continue;
    const cleanCode = String(code).toUpperCase().replace(/\s+/g, '');
    if (excludeCodes.has(cleanCode)) continue;

    const { colors: oColors, all: oAll } = extractColorTokens(name);
    const overlap = itemColors.filter((c) => oColors.includes(c));
    if (overlap.length === 0) continue;

    const exact =
      itemAll.filter((t) => !['light', 'dark', 'medium', 'deep', 'pale', 'bright', 'burnt'].includes(t)).sort().join(',') ===
      oAll.filter((t) => !['light', 'dark', 'medium', 'deep', 'pale', 'bright', 'burnt'].includes(t)).sort().join(',');

    scored.push({ brand: o.brand, code, name, score: overlap.length + (exact ? 100 : 0), exact });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxResults);
}

// 전체 아이템 하나에 대한 매칭 결과 (보유여부 + 추가유사색) 계산
export function computeItemMatch(item, ownedOtherBrand, ownedAcrylic) {
  const flags = computeOwnedFlags(item, ownedOtherBrand, ownedAcrylic);
  const additional = findAdditionalSimilar(item, ownedAcrylic);
  return { ...flags, additionalSimilar: additional };
}

// 자유 텍스트/코드 검색 (매칭검색 화면에서 사용)
export function searchPaints(query, tamiyaMaster, ownedOtherBrand, ownedAcrylic) {
  if (!query || !query.trim()) return [];
  const q = query.trim().toLowerCase();

  // 1) 타미야 코드/이름 검색
  const tamiyaHits = tamiyaMaster.filter(
    (item) =>
      item.code.toLowerCase().includes(q) ||
      (item.colorName && item.colorName.toLowerCase().includes(q))
  );
  if (tamiyaHits.length > 0) {
    return tamiyaHits.map((item) => ({
      type: 'tamiya',
      item,
      match: computeItemMatch(item, ownedOtherBrand, ownedAcrylic),
    }));
  }

  // 2) 타미야 매칭이 없으면 보유 목록(브랜드 유사색) 전체에서 색상명 토큰 겹침으로 후보 탐색
  const { colors: qColors } = extractColorTokens(q);
  if (qColors.length === 0) return [];

  const results = [];
  for (const o of [...ownedOtherBrand, ...ownedAcrylic]) {
    const { colors } = extractColorTokens(o.text);
    const overlap = qColors.filter((c) => colors.includes(c));
    if (overlap.length > 0) {
      results.push({ type: 'owned', brand: o.brand, text: o.text, score: overlap.length });
    }
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 15).map((r) => ({ type: 'owned', item: r }));
}
