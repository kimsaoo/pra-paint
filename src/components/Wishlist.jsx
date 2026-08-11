import { useMemo } from 'react';
import { computeItemMatch } from '../lib/matching';
import { BrandChip, PaintCap } from './Common';

export default function Wishlist({ tamiyaMaster, ownedOtherBrand, ownedAcrylic, kits }) {
  const missing = useMemo(() => {
    return tamiyaMaster
      .map((item) => ({ item, match: computeItemMatch(item, ownedOtherBrand, ownedAcrylic) }))
      .filter(({ match }) => match.ownedStatus === '미보유')
      .sort((a, b) => (b.item.kitsNeeded?.length || 0) - (a.item.kitsNeeded?.length || 0));
  }, [tamiyaMaster, ownedOtherBrand, ownedAcrylic]);

  return (
    <div>
      <div className="section-title">🛒 위시리스트 ({missing.length})</div>
      <p className="text-faint" style={{ marginBottom: 14 }}>
        미보유 도료와, 살 때 참고할 브랜드별 유사색 후보입니다.
      </p>

      {missing.length === 0 && (
        <div className="empty-state">
          <div className="icon">🎉</div>
          모든 필요 도료를 보유하고 있습니다
        </div>
      )}

      {missing.map(({ item, match }) => (
        <div className="card" key={item.id}>
          <div style={{ display: 'flex', gap: 10 }}>
            <PaintCap brand="tamiya" size="lg" />
            <div style={{ flex: 1 }}>
              <div>
                <span className="code-text">{item.code}</span>{' '}
                <span className="text-dim">{item.colorName}</span>
              </div>
              {item.kitsNeeded?.length > 0 && (
                <div className="text-faint mt-4">
                  필요 킷: {item.kitsNeeded.map((id) => kits.find((k) => k.id === id)?.name).filter(Boolean).join(', ')}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {item.vallejoSimilar && <BrandChip brand="vallejo">{item.vallejoSimilar}</BrandChip>}
            {item.migSimilar && <BrandChip brand="mig">{item.migSimilar}</BrandChip>}
            {item.akSimilar && <BrandChip brand="ak">{item.akSimilar}</BrandChip>}
          </div>

          {match.additionalSimilar?.length > 0 && (
            <div className="mt-8 text-faint">
              * 추가 후보: {match.additionalSimilar.map((s) => `${s.code}(${s.name})`).join(', ')}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
