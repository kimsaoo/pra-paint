import { useMemo, useState } from 'react';
import PaintFormFields, { emptyPaintForm, isPaintFormValid } from './PaintForm';
import { BrandChip, OwnedBadge } from './Common';
import { addItem, updateItem, deleteItem } from '../lib/useCollection';
import { linkSimilarPaints, unlinkSimilarPaints, setSimilarVerified } from '../lib/paintLinks';
import { getSimilarPaints } from '../lib/matching';

/**
 * paint: null(신규) | 기존 paint 객체
 * forceOwned: 보유목록 화면에서 열 때 true로 넘겨서 owned를 강제
 * allPaints/byId: 유사도료 검색/표시에 사용
 * onClose(savedPaint?): savedPaint를 넘기면 호출부에서 후속 처리(예: 킷 연결) 가능
 */
export default function PaintEditModal({ paint, forceOwned, allPaints, byId, onClose }) {
  const [form, setForm] = useState(
    paint
      ? { manufacturer: paint.manufacturer, paintType: paint.paintType, code: paint.code, name: paint.name, note: paint.note || '' }
      : emptyPaintForm
  );
  const [owned, setOwned] = useState(forceOwned ? true : paint?.owned || false);
  const [similarQuery, setSimilarQuery] = useState('');

  const similarPaints = useMemo(() => (paint ? getSimilarPaints(paint, byId) : []), [paint, byId]);

  const searchCandidates = useMemo(() => {
    if (!similarQuery.trim() || !paint) return [];
    const q = similarQuery.trim().toLowerCase();
    const linkedIds = new Set((paint.similarLinks || []).map((l) => l.paintId));
    return allPaints
      .filter((p) => p.id !== paint.id && !linkedIds.has(p.id))
      .filter((p) => p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [similarQuery, allPaints, paint]);

  async function save() {
    if (!isPaintFormValid(form)) return;
    const data = { ...form, code: form.code.trim(), name: form.name.trim(), owned };
    if (paint) {
      await updateItem('paints', paint.id, data);
      onClose({ id: paint.id, ...data });
    } else {
      const ref = await addItem('paints', { ...data, similarLinks: [] });
      onClose({ id: ref.id, ...data, similarLinks: [] });
    }
  }

  async function remove() {
    if (!confirm(`"${paint.code} ${paint.name}"을 삭제할까요? 다른 킷에 연결되어 있다면 그 연결도 끊어집니다.`)) return;
    // 이 도료를 유사도료로 참조하는 다른 도료들의 링크도 정리
    for (const s of similarPaints) {
      await unlinkSimilarPaints(paint, s);
    }
    await deleteItem('paints', paint.id);
    onClose(null);
  }

  async function addSimilar(target) {
    await linkSimilarPaints(paint, target, true);
    setSimilarQuery('');
  }

  return (
    <div className="modal-overlay" onClick={() => onClose()}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{paint ? '도료 수정' : '도료 추가'}</div>

        <PaintFormFields value={form} onChange={setForm} />

        {!forceOwned && (
          <div className="field-group">
            <label className="checkbox-item" style={{ marginBottom: 0 }}>
              <input type="checkbox" checked={owned} onChange={(e) => setOwned(e.target.checked)} />
              보유 중
            </label>
          </div>
        )}

        {paint && (
          <div className="field-group">
            <label>유사도료 ({similarPaints.length})</label>
            {similarPaints.length === 0 && <div className="text-faint">아직 연결된 유사도료가 없습니다</div>}
            {similarPaints.map((s) => (
              <div className="flex-between mt-4" key={s.id}>
                <div>
                  <BrandChip manufacturer={s.manufacturer}>
                    {s.code} {s.name}
                  </BrandChip>{' '}
                  <OwnedBadge owned={s.owned} />
                  {s.verified === false && <span className="badge unverified" style={{ marginLeft: 4 }}>미검증</span>}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {s.verified === false ? (
                    <button className="btn sm primary" onClick={() => setSimilarVerified(paint, s, true)}>
                      검증완료
                    </button>
                  ) : (
                    <button className="btn sm" onClick={() => setSimilarVerified(paint, s, false)}>
                      미검증표시
                    </button>
                  )}
                  <button className="icon-btn" onClick={() => unlinkSimilarPaints(paint, s)}>
                    ✕
                  </button>
                </div>
              </div>
            ))}

            <input
              className="mt-8"
              placeholder="코드/이름으로 검색해서 유사도료 추가"
              value={similarQuery}
              onChange={(e) => setSimilarQuery(e.target.value)}
            />
            {searchCandidates.map((c) => (
              <div className="flex-between mt-4" key={c.id}>
                <BrandChip manufacturer={c.manufacturer}>
                  {c.code} {c.name}
                </BrandChip>
                <button className="btn sm primary" onClick={() => addSimilar(c)}>
                  연결
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="modal-actions">
          {paint && (
            <button className="btn danger" onClick={remove}>
              삭제
            </button>
          )}
          <button className="btn" onClick={() => onClose()}>
            취소
          </button>
          <button className="btn primary" onClick={save}>
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
