import { extractColorTokens } from './colorWords';

/**
 * 새 스키마에서는 보유여부가 paint.owned 필드로 직접 관리되고,
 * 유사도료도 paint.similarLinks(=[{paintId, verified}])로 이미 연결되어 있어서
 * 예전처럼 코드 문자열을 파싱/대조할 필요가 없습니다.
 */

export function paintsById(paints) {
  const map = new Map();
  for (const p of paints) map.set(p.id, p);
  return map;
}

/** 이 도료와 연결된 유사도료 목록 (실제 도료 객체 + verified 플래그) */
export function getSimilarPaints(paint, byId) {
  return (paint.similarLinks || [])
    .map((l) => {
      const target = byId.get(l.paintId);
      return target ? { ...target, verified: l.verified } : null;
    })
    .filter(Boolean);
}

/** 색상명 텍스트 겹침으로 아직 연결 안 된 보유 도료 중 추가 후보를 찾음 (④ 알고리즘, 브랜드 무관 버전) */
export function findAdditionalSimilarCandidates(paint, allPaints, maxResults = 3) {
  const { colors: paintColors, all: paintAll } = extractColorTokens(paint.name);
  if (paintColors.length === 0) return [];

  const linkedIds = new Set((paint.similarLinks || []).map((l) => l.paintId));
  const scored = [];

  for (const other of allPaints) {
    if (other.id === paint.id || !other.owned || linkedIds.has(other.id)) continue;
    const { colors: oColors, all: oAll } = extractColorTokens(other.name);
    const overlap = paintColors.filter((c) => oColors.includes(c));
    if (overlap.length === 0) continue;
    const exact = paintAll.slice().sort().join(',') === oAll.slice().sort().join(',');
    scored.push({ ...other, score: overlap.length + (exact ? 100 : 0) });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxResults);
}

/** 자유 텍스트/코드 검색 */
export function searchPaints(query, allPaints) {
  if (!query || !query.trim()) return [];
  const q = query.trim().toLowerCase();

  const directHits = allPaints.filter(
    (p) => p.code.toLowerCase().includes(q) || (p.name && p.name.toLowerCase().includes(q))
  );
  if (directHits.length > 0) return directHits;

  const { colors: qColors } = extractColorTokens(q);
  if (qColors.length === 0) return [];

  const scored = allPaints
    .map((p) => {
      const { colors } = extractColorTokens(p.name);
      const overlap = qColors.filter((c) => colors.includes(c)).length;
      return { ...p, score: overlap };
    })
    .filter((p) => p.score > 0);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 20);
}

/** 킷이 필요로 하는 도료 목록 (kitPaintLinks 통해서) */
export function paintsForKit(kitId, kitPaintLinks, allPaints) {
  const byId = paintsById(allPaints);
  return kitPaintLinks
    .filter((l) => l.kitId === kitId)
    .map((l) => byId.get(l.paintId))
    .filter(Boolean);
}
