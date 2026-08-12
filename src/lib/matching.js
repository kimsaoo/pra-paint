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

/** 킷이 필요로 하는 도료 목록 (kitPaintLinks 통해서) */
export function paintsForKit(kitId, kitPaintLinks, allPaints) {
  const byId = paintsById(allPaints);
  return kitPaintLinks
    .filter((l) => l.kitId === kitId)
    .map((l) => byId.get(l.paintId))
    .filter(Boolean);
}
