import { writeBatch, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { normalizeCodeForManufacturer } from './normalize';

/**
 * 모든 도료를 훑어서 "코드 표기만 고치면 되는 것"과 "중복이라 합쳐야 하는 것"을 나눠서 계획을 세움.
 * 실제 쓰기 작업은 하지 않고 미리보기용 계획만 반환.
 */
export function planNormalizationCleanup(paints) {
  const targets = paints.map((p) => ({
    paint: p,
    normalized: normalizeCodeForManufacturer(p.manufacturer, p.code),
  }));

  const groups = new Map();
  for (const t of targets) {
    const key = `${t.paint.manufacturer}::${t.normalized.toUpperCase()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }

  const renames = [];
  const merges = [];

  for (const group of groups.values()) {
    if (group.length === 1) {
      const t = group[0];
      if (t.paint.code !== t.normalized) renames.push({ paint: t.paint, newCode: t.normalized });
      continue;
    }
    // 여러 도료가 같은 정규화 코드로 모이면 병합 대상.
    // 대표(canonical)는: 이미 표준 표기인 것 > 보유중인 것 > 그냥 첫번째
    const canonical =
      group.find((t) => t.paint.code === t.normalized) || group.find((t) => t.paint.owned) || group[0];
    const duplicates = group.filter((t) => t !== canonical);
    merges.push({ canonical: canonical.paint, duplicates: duplicates.map((d) => d.paint), newCode: canonical.normalized });
  }

  return { renames, merges };
}

/** 계획을 실제로 Firestore에 적용 (코드 수정 + 중복 병합) */
export async function applyNormalizationCleanup(plan, kitPaintLinks, allPaints) {
  const batch = writeBatch(db);

  for (const r of plan.renames) {
    batch.update(doc(db, 'paints', r.paint.id), { code: r.newCode });
  }

  for (const m of plan.merges) {
    const canonicalId = m.canonical.id;
    let owned = m.canonical.owned;
    let wishlisted = !!m.canonical.wishlisted;
    let similarLinks = [...(m.canonical.similarLinks || [])];

    for (const dup of m.duplicates) {
      owned = owned || dup.owned;
      wishlisted = wishlisted || !!dup.wishlisted;

      for (const l of dup.similarLinks || []) {
        if (l.paintId === canonicalId) continue;
        if (!similarLinks.some((x) => x.paintId === l.paintId)) similarLinks.push(l);
      }

      // 이 중복 도료를 가리키던 킷 연결을 대표 도료로 옮김 (이미 연결돼있으면 중복 링크는 삭제)
      const dupLinks = kitPaintLinks.filter((l) => l.paintId === dup.id);
      for (const link of dupLinks) {
        const alreadyLinked = kitPaintLinks.some((l) => l.kitId === link.kitId && l.paintId === canonicalId);
        if (alreadyLinked) batch.delete(doc(db, 'kitPaintLinks', link.id));
        else batch.update(doc(db, 'kitPaintLinks', link.id), { paintId: canonicalId });
      }

      // 다른 도료들이 이 중복 도료를 유사도료로 links 걸어놨으면 대표 도료로 옮김
      for (const p of allPaints) {
        if (!p.similarLinks?.length || p.id === dup.id || p.id === canonicalId) continue;
        if (p.similarLinks.some((l) => l.paintId === dup.id)) {
          const newLinks = p.similarLinks
            .map((l) => (l.paintId === dup.id ? { ...l, paintId: canonicalId } : l))
            .filter((l, idx, arr) => arr.findIndex((x) => x.paintId === l.paintId) === idx)
            .filter((l) => l.paintId !== p.id);
          batch.update(doc(db, 'paints', p.id), { similarLinks: newLinks });
        }
      }

      batch.delete(doc(db, 'paints', dup.id));
    }

    batch.update(doc(db, 'paints', canonicalId), {
      code: m.newCode,
      owned,
      wishlisted,
      similarLinks: similarLinks.filter((l) => l.paintId !== canonicalId),
    });
  }

  await batch.commit();
}
