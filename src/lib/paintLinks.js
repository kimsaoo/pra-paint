import { updateItem } from './useCollection';

/** paintA ↔ paintB 를 유사도료로 연결 (양쪽 문서에 모두 기록되어 어느 화면에서든 동일하게 보임) */
export async function linkSimilarPaints(paintA, paintB, verified = true) {
  const addLink = (paint, other) => {
    const links = [...(paint.similarLinks || [])];
    if (!links.some((l) => l.paintId === other.id)) links.push({ paintId: other.id, verified });
    return links;
  };
  await Promise.all([
    updateItem('paints', paintA.id, { similarLinks: addLink(paintA, paintB) }),
    updateItem('paints', paintB.id, { similarLinks: addLink(paintB, paintA) }),
  ]);
}

/** 유사도료 연결 해제 */
export async function unlinkSimilarPaints(paintA, paintB) {
  const removeLink = (paint, other) => (paint.similarLinks || []).filter((l) => l.paintId !== other.id);
  await Promise.all([
    updateItem('paints', paintA.id, { similarLinks: removeLink(paintA, paintB) }),
    updateItem('paints', paintB.id, { similarLinks: removeLink(paintB, paintA) }),
  ]);
}

/** 유사도료 연결의 검증 상태 변경 (양쪽 동기화) */
export async function setSimilarVerified(paintA, paintB, verified) {
  const setVerified = (paint, other) =>
    (paint.similarLinks || []).map((l) => (l.paintId === other.id ? { ...l, verified } : l));
  await Promise.all([
    updateItem('paints', paintA.id, { similarLinks: setVerified(paintA, paintB) }),
    updateItem('paints', paintB.id, { similarLinks: setVerified(paintB, paintA) }),
  ]);
}
