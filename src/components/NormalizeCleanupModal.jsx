import { useMemo, useState } from 'react';
import { planNormalizationCleanup, applyNormalizationCleanup } from '../lib/normalizeCleanup';
import { BrandChip } from './Common';

export default function NormalizeCleanupModal({ paints, kitPaintLinks, onClose }) {
  const plan = useMemo(() => planNormalizationCleanup(paints), [paints]);
  const [applying, setApplying] = useState(false);
  const [done, setDone] = useState(false);

  const totalChanges = plan.renames.length + plan.merges.length;

  async function apply() {
    setApplying(true);
    try {
      await applyNormalizationCleanup(plan, kitPaintLinks, paints);
      setDone(true);
    } catch (err) {
      console.error(err);
      alert('정리 중 오류가 발생했습니다. 콘솔을 확인해주세요.');
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={() => !applying && onClose()}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">🧹 코드 정규화 / 중복 정리</div>

        {done ? (
          <div>
            <p className="text-dim">정리가 완료됐습니다.</p>
            <button className="btn primary block mt-8" onClick={onClose}>
              닫기
            </button>
          </div>
        ) : totalChanges === 0 ? (
          <div>
            <p className="text-dim">정리할 항목이 없습니다. 모든 도료 코드가 표준 표기입니다.</p>
            <button className="btn block mt-8" onClick={onClose}>
              닫기
            </button>
          </div>
        ) : (
          <div>
            <p className="text-dim" style={{ marginBottom: 12 }}>
              아래 내용을 확인하고 적용해주세요. 병합되는 도료의 유사도료/킷 연결 정보는 대표 도료로 그대로 옮겨집니다.
            </p>

            {plan.renames.length > 0 && (
              <div className="field-group">
                <label>표기만 수정 ({plan.renames.length}건)</label>
                {plan.renames.map((r) => (
                  <div className="mt-4" key={r.paint.id}>
                    <BrandChip manufacturer={r.paint.manufacturer}>{r.paint.code}</BrandChip>
                    {' → '}
                    <span className="code-text">{r.newCode}</span>
                  </div>
                ))}
              </div>
            )}

            {plan.merges.length > 0 && (
              <div className="field-group">
                <label>중복 병합 ({plan.merges.length}건)</label>
                {plan.merges.map((m) => (
                  <div className="mt-8" key={m.canonical.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
                    <div className="text-dim">
                      대표: <span className="code-text">{m.newCode}</span> {m.canonical.name}
                    </div>
                    {m.duplicates.map((d) => (
                      <div className="text-faint" key={d.id}>
                        └ 병합됨: {d.code} {d.name}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            <div className="modal-actions">
              <button className="btn" onClick={onClose} disabled={applying}>
                취소
              </button>
              <button className="btn primary" onClick={apply} disabled={applying}>
                {applying ? '적용 중...' : `${totalChanges}건 적용`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
