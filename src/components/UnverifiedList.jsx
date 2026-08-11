import { useMemo } from 'react';
import { unverifiedPaints, getSimilarPaints } from '../lib/matching';
import { setSimilarVerified, unlinkSimilarPaints } from '../lib/paintLinks';
import { BrandChip, OwnedBadge } from './Common';

export default function UnverifiedList({ paints, byId }) {
  const items = useMemo(() => unverifiedPaints(paints), [paints]);

  return (
    <div>
      <div className="section-title">⚠️ 미검증 유사도료 ({items.length})</div>
      <p className="text-faint" style={{ marginBottom: 14 }}>
        아직 실제 색상 일치를 확인하지 못한 유사도료 연결입니다. 확인 후 검증완료 하거나 연결을
        끊고 다른 도료로 다시 연결해주세요.
      </p>

      {items.length === 0 && (
        <div className="empty-state">
          <div className="icon">✅</div>
          미검증 항목이 없습니다
        </div>
      )}

      {items.map((paint) => {
        const similar = getSimilarPaints(paint, byId).filter((s) => s.verified === false);
        return (
          <div className="card" key={paint.id}>
            <div>
              <BrandChip manufacturer={paint.manufacturer}>
                {paint.code} {paint.name}
              </BrandChip>
            </div>
            {similar.map((s) => (
              <div className="flex-between mt-8" key={s.id}>
                <div>
                  <span className="badge unverified">미검증</span>{' '}
                  <BrandChip manufacturer={s.manufacturer}>
                    {s.code} {s.name}
                  </BrandChip>{' '}
                  <OwnedBadge owned={s.owned} />
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn sm primary" onClick={() => setSimilarVerified(paint, s, true)}>
                    검증완료
                  </button>
                  <button className="btn sm" onClick={() => unlinkSimilarPaints(paint, s)}>
                    연결끊기
                  </button>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
