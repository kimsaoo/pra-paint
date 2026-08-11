import { useMemo, useState } from 'react';
import { searchPaints, getSimilarPaints, findAdditionalSimilarCandidates } from '../lib/matching';
import { BrandChip, OwnedBadge, PaintCap } from './Common';

export default function MatchSearch({ paints, byId }) {
  const [query, setQuery] = useState('');

  const results = useMemo(() => searchPaints(query, paints), [query, paints]);

  return (
    <div>
      <div className="section-title">🔍 매칭 검색</div>
      <p className="text-faint mt-4" style={{ marginBottom: 14 }}>
        코드나 색상명을 입력하면 보유 여부와 연결된 유사도료를 바로 확인합니다.
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

      {results.map((paint) => {
        const similar = getSimilarPaints(paint, byId);
        const extra = findAdditionalSimilarCandidates(paint, paints);
        return (
          <div className="card" key={paint.id}>
            <div className="flex-between">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <PaintCap manufacturer={paint.manufacturer} />
                <span className="code-text">{paint.code}</span>
                <span className="text-dim">{paint.name}</span>
              </div>
              <OwnedBadge owned={paint.owned} />
            </div>
            <div className="text-faint mt-4">
              {paint.manufacturer} · {paint.paintType}
            </div>

            {similar.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {similar.map((s) => (
                  <span key={s.id} className="badge" style={{ background: 'transparent', border: '1px solid var(--border)' }}>
                    <BrandChip manufacturer={s.manufacturer}>
                      {s.code} {s.name}
                    </BrandChip>
                    {s.owned ? ' ✅' : ' ·미보유'}
                    {s.verified === false && ' ⚠️'}
                  </span>
                ))}
              </div>
            )}

            {extra.length > 0 && (
              <div className="mt-8 text-faint">
                * 추가 후보(미연결): {extra.map((s) => `${s.code}(${s.name})`).join(', ')}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
