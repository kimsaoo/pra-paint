/**
 * 새 스키마에서는 보유여부가 paint.owned 필드로 직접 관리되고,
 * 유사도료도 paint.similarLinks(=[{paintId, verified}])로 이미 연결되어 있어서
 * 예전처럼 코드 문자열을 파싱/대조할 필요가 없습니다.
 */
import { extractColorTokens } from './colorWords';

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

/** 킷이 필요로 하는 도료 목록 (kitPaintLinks 통해서) */
export function paintsForKit(kitId, kitPaintLinks, allPaints) {
  const byId = paintsById(allPaints);
  return kitPaintLinks
    .filter((l) => l.kitId === kitId)
    .map((l) => byId.get(l.paintId))
    .filter(Boolean);
}

/** 색상명 텍스트 토큰 겹침으로 유사도료 후보를 찾음 (등록 시점 자동추천용) */
export function findSimilarCandidates(name, allPaints, excludeIds = new Set(), maxResults = 5) {
  const { colors: targetColors, all: targetAll } = extractColorTokens(name);
  if (targetColors.length === 0) return [];

  const scored = [];
  for (const p of allPaints) {
    if (excludeIds.has(p.id)) continue;
    const { colors, all } = extractColorTokens(p.name);
    const overlap = targetColors.filter((c) => colors.includes(c));
    if (overlap.length === 0) continue;
    const exact = targetAll.slice().sort().join(',') === all.slice().sort().join(',');
    scored.push({ ...p, score: overlap.length + (exact ? 100 : 0) });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxResults);
}
