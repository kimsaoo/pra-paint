import { useMemo } from 'react';
import { getSimilarPaints } from '../lib/matching';
import { updateItem } from '../lib/useCollection';
import { BrandChip, OwnedBadge, PaintCap, ColorSwatch } from './Common';

export default function Wishlist({ paints, kitPaintLinks, kits, byId, manufacturers = [] }) {
  const items = useMemo(() => paints.filter((p) => p.wishlisted), [paints]);
  const iconByManufacturer = useMemo(() => new Map(manufacturers.map((m) => [m.name, m.iconUrl])), [manufacturers]);

  function kitNamesFor(paintId) {
    return kitPaintLinks
      .filter((l) => l.paintId === paintId)
      .map((l) => kits.find((k) => k.id === l.kitId)?.name)
      .filter(Boolean);
  }

  async function remove(paint) {
    await updateItem('paints', paint.id, { wishlisted: false });
  }

  return (
    <div>
      <div className="section-title">🛒 위시리스트 ({items.length})</div>
      <p className="text-faint" style={{ marginBottom: 14 }}>
        "전체도료"나 "킷" 화면에서 🛒 담기 버튼을 누르면 여기 모입니다. 산 도료는 빼주세요.
      </p>

      {items.length === 0 && (
        <div className="empty-state">
          <div className="icon">🛒</div>
          아직 담은 도료가 없습니다
          <div className="text-faint mt-8">"전체도료" 화면에서 도료를 열어 담아보세요</div>
        </div>
      )}

      {items.map((paint) => {
        const kitNames = kitNamesFor(paint.id);
        const similarOwned = getSimilarPaints(paint, byId).filter((s) => s.owned);
        return (
          <div className="card" key={paint.id}>
            <div style={{ display: 'flex', gap: 10 }}>
              <PaintCap manufacturer={paint.manufacturer} size="lg" iconUrl={iconByManufacturer.get(paint.manufacturer)} />
              <ColorSwatch name={paint.name} size="lg" />
              <div style={{ flex: 1 }}>
                <div className="flex-between">
                  <div>
                    <span className="code-text">{paint.code}</span> <span className="text-dim">{paint.name}</span>
                  </div>
                  <OwnedBadge owned={paint.owned} />
                </div>
                <div className="text-faint mt-4">
                  {paint.manufacturer} · {paint.paintType}
                  {kitNames.length > 0 && ` · 필요 킷: ${kitNames.join(', ')}`}
                </div>
              </div>
            </div>

            {similarOwned.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {similarOwned.map((s) => (
                  <BrandChip key={s.id} manufacturer={s.manufacturer}>
                    {s.code} {s.name}
                  </BrandChip>
                ))}
              </div>
            )}

            <div className="mt-8" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn sm danger" onClick={() => remove(paint)}>
                위시리스트에서 빼기
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
