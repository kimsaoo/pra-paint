import { useMemo, useState } from 'react';
import { computeItemMatch, searchPaints } from '../lib/matching';
import { BrandChip, OwnedBadge } from './Common';

export default function MatchSearch({ tamiyaMaster, ownedOtherBrand, ownedAcrylic, kits }) {
  const [query, setQuery] = useState('');

  const kitName = (id) => kits.find((k) => k.id === id)?.name || id;

  const results = useMemo(
    () => searchPaints(query, tamiyaMaster, ownedOtherBrand, ownedAcrylic),
    [query, tamiyaMaster, ownedOtherBrand, ownedAcrylic]
  );

  return (
    <div>
      <div className="section-title">🔍 매칭 검색</div>
      <p className="text-faint mt-4" style={{ marginBottom: 14 }}>
        타미야 코드/색상명을 입력하면 보유 여부와 브랜드별 유사색을 바로 확인합니다.
      </p>
      <div className="search-bar">
        <input
          placeholder="예: LP-5, Flat black, 70.951..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {!query.trim() && (
        <div className="empty-state">
          <div className="icon">🎨</div>
          코드나 색상명을 입력해보세요
        </div>
      )}

      {query.trim() && results.length === 0 && (
        <div className="empty-state">
          <div className="icon">🚫</div>
          일치하는 도료를 찾지 못했습니다
        </div>
      )}

      {results.map((r, idx) => {
        if (r.type === 'tamiya') {
          const item = r.item;
          const match = r.match;
          return (
            <div className="card" key={item.id}>
              <div className="flex-between">
                <div>
                  <span className="code-text">{item.code}</span>{' '}
                  <span className="text-dim">{item.colorName}</span>
                </div>
                <OwnedBadge owned={match.ownedStatus === '보유'} />
              </div>

              {item.kitsNeeded?.length > 0 && (
                <div className="text-faint mt-8">
                  필요 킷: {item.kitsNeeded.map(kitName).join(', ')}
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {match.tamiyaOwned && <span className="badge owned">타미야 자체 보유</span>}
                {item.vallejoSimilar && (
                  <span className="badge" style={{ background: 'transparent', border: '1px solid var(--border)' }}>
                    <BrandChip brand="vallejo">{item.vallejoSimilar}</BrandChip>
                    {match.vallejoOwned ? ' ✅' : ' ·미보유'}
                  </span>
                )}
                {item.migSimilar && (
                  <span className="badge" style={{ background: 'transparent', border: '1px solid var(--border)' }}>
                    <BrandChip brand="mig">{item.migSimilar}</BrandChip>
                    {match.migOwned ? ' ✅' : ' ·미보유'}
                  </span>
                )}
                {item.akSimilar && (
                  <span className="badge" style={{ background: 'transparent', border: '1px solid var(--border)' }}>
                    <BrandChip brand="ak">{item.akSimilar}</BrandChip>
                    {match.akOwned ? ' ✅' : ' ·미보유'}
                  </span>
                )}
              </div>

              {match.additionalSimilar?.length > 0 && (
                <div className="mt-8 text-faint">
                  * 추가 유사색: {match.additionalSimilar.map((s) => `${s.code}(${s.name})`).join(', ')}
                </div>
              )}
            </div>
          );
        }

        // owned-list 텍스트 매칭 결과
        const o = r.item;
        return (
          <div className="card" key={idx}>
            <BrandChip brand={o.brand} />{' '}
            <span className="text-dim">{o.text}</span>
          </div>
        );
      })}
    </div>
  );
}
