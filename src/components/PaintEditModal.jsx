import { useMemo, useState } from 'react';
import PaintFormFields, { emptyPaintForm, isPaintFormValid } from './PaintForm';
import { BrandChip, OwnedBadge } from './Common';
import { addItem, updateItem, deleteItem } from '../lib/useCollection';
import { linkSimilarPaints, unlinkSimilarPaints, setSimilarVerified } from '../lib/paintLinks';
import { getSimilarPaints, findSimilarCandidates } from '../lib/matching';

/**
 * paint: null(신규) | 기존 paint 객체
 * forceOwned: 보유목록 화면에서 열 때 true로 넘겨서 owned를 강제
 * allPaints/byId: 유사도료 검색/표시에 사용
 * manufacturers: 도료 제조사 이름 목록 (동적, ManufacturerManager에서 관리)
 * onClose(savedPaint?): savedPaint를 넘기면 호출부에서 후속 처리(예: 킷 연결) 가능
 */
export default function PaintEditModal({ paint, forceOwned, allPaints, byId, manufacturers = [], onClose }) {
  const [form, setForm] = useState(
    paint
      ? { manufacturer: paint.manufacturer, paintType: paint.paintType, code: paint.code, name: paint.name, note: paint.note || '' }
      : emptyPaintForm
  );
  const [owned, setOwned] = useState(forceOwned ? true : paint?.owned || false);
  const [similarQuery, setSimilarQuery] = useState('');
  const [selectedCandidateIds, setSelectedCandidateIds] = useState(new Set());

  const similarPaints = useMemo(() => (paint ? getSimilarPaints(paint, byId) : []), [paint, byId]);

  const excludeIds = useMemo(() => {
    const ids = new Set((paint?.similarLinks || []).map((l) => l.paintId));
    if (paint) ids.add(paint.id);
    return ids;
  }, [paint]);

  // 색상명 기반 자동 추천 (등록/수정 화면 공통) — 이름을 입력하면 실시간으로 후보를 보여줌
  const autoCandidates = useMemo(() => {
    if (!form.name.trim()) return [];
    return findSimilarCandidates(form.name, allPaints, excludeIds, 5);
  }, [form.name, allPaints, excludeIds]);

  const searchCandidates = useMemo(() => {
    if (!similarQuery.trim() || !paint) return [];
    const q = similarQuery.trim().toLowerCase();
    const linkedIds = new Set((paint.similarLinks || []).map((l) => l.paintId));
    return allPaints
      .filter((p) => p.id !== paint.id && !linkedIds.has(p.id))
      .filter((p) => p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [similarQuery, allPaints, paint]);

  function toggleCandidate(id) {
    setSelectedCandidateIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    if (!isPaintFormValid(form)) return;
    const data = { ...form, code: form.code.trim(), name: form.name.trim(), owned };

    let savedPaint;
    if (paint) {
      await updateItem('paints', paint.id, data);
      savedPaint = { id: paint.id, ...data, similarLinks: paint.similarLinks || [] };
    } else {
      const ref = await addItem('paints', { ...data, similarLinks: [] });
      savedPaint = { id: ref.id, ...data, similarLinks: [] };
    }

    // 체크한 자동추천 후보를 유사도료로 연결 (색상 매칭 기반이라 확인 후 선택한 것만 연결)
    const chosen = autoCandidates.filter((c) => selectedCandidateIds.has(c.id));
    for (const c of chosen) {
      await linkSimilarPaints(savedPaint, c, true);
    }

    onClose(savedPaint);
  }

  async function remove() {
    if (!confirm(`"${paint.code} ${paint.name}"을 삭제할까요? 다른 킷에 연결되어 있다면 그 연결도 끊어집니다.`)) return;
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

        <PaintFormFields value={form} onChange={setForm} manufacturers={manufacturers} />

        {!forceOwned && (
          <div className="field-group">
            <label className="checkbox-item" style={{ marginBottom: 0 }}>
              <input type="checkbox" checked={owned} onChange={(e) => setOwned(e.target.checked)} />
              보유 중
            </label>
          </div>
        )}

        {autoCandidates.length > 0 && (
          <div className="field-group">
            <label>🎨 색상명 기반 유사도료 추천 (선택해서 연결)</label>
            {autoCandidates.map((c) => (
              <div className="flex-between mt-4" key={c.id}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={selectedCandidateIds.has(c.id)}
                    onChange={() => toggleCandidate(c.id)}
                  />
                  <BrandChip manufacturer={c.manufacturer}>
                    {c.code} {c.name}
                  </BrandChip>
                  <OwnedBadge owned={c.owned} />
                </label>
              </div>
            ))}
            <div className="text-faint mt-4">
              색상명 단어가 겹치는 도료를 자동으로 찾은 것이라 정확하지 않을 수 있습니다. 확인하고 체크해주세요.
            </div>
          </div>
        )}

        {paint && (
          <div className="field-group">
            <label>연결된 유사도료 ({similarPaints.length})</label>
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
