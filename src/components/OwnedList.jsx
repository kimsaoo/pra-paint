import { useMemo, useState } from 'react';
import PaintFormFields, { emptyPaintForm, isPaintFormValid } from './PaintForm';
import { PaintCap } from './Common';
import { addItem, updateItem, deleteItem } from '../lib/useCollection';
import { PAINT_MANUFACTURERS } from '../lib/constants';

export default function OwnedList({ paints }) {
  const [filterManufacturer, setFilterManufacturer] = useState('all');
  const [editing, setEditing] = useState(null); // null | 'new' | paint
  const [form, setForm] = useState(emptyPaintForm);

  const owned = useMemo(
    () =>
      paints
        .filter((p) => p.owned)
        .filter((p) => filterManufacturer === 'all' || p.manufacturer === filterManufacturer)
        .sort((a, b) => a.manufacturer.localeCompare(b.manufacturer) || a.code.localeCompare(b.code)),
    [paints, filterManufacturer]
  );

  function openNew() {
    setForm(emptyPaintForm);
    setEditing('new');
  }

  function openEdit(p) {
    setForm({ manufacturer: p.manufacturer, paintType: p.paintType, code: p.code, name: p.name, note: p.note || '' });
    setEditing(p);
  }

  async function save() {
    if (!isPaintFormValid(form)) {
      const missing = [];
      if (!form.manufacturer) missing.push('제조사');
      if (!form.paintType) missing.push('도료 타입');
      if (!form.code.trim()) missing.push('도료 코드');
      if (!form.name.trim()) missing.push('도료명');
      alert(`다음 항목을 채워주세요: ${missing.join(', ')}`);
      return;
    }
    const data = { ...form, code: form.code.trim(), name: form.name.trim(), owned: true };
    if (editing === 'new') {
      await addItem('paints', { ...data, similarLinks: [] });
    } else {
      await updateItem('paints', editing.id, data);
    }
    setEditing(null);
  }

  async function markUnowned() {
    // 보유목록에서 "삭제"는 도료 자체를 지우는 게 아니라 보유 해제로 처리 (킷 연결이 남아있을 수 있어서)
    await updateItem('paints', editing.id, { owned: false });
    setEditing(null);
  }

  return (
    <div>
      <div className="flex-between">
        <div className="section-title">🧴 보유목록 ({owned.length})</div>
        <button className="btn primary sm" onClick={openNew}>
          + 추가
        </button>
      </div>

      <div className="filter-row">
        <button className={`filter-chip ${filterManufacturer === 'all' ? 'active' : ''}`} onClick={() => setFilterManufacturer('all')}>
          전체
        </button>
        {PAINT_MANUFACTURERS.map((m) => (
          <button
            key={m}
            className={`filter-chip ${filterManufacturer === m ? 'active' : ''}`}
            onClick={() => setFilterManufacturer(m)}
          >
            {m}
          </button>
        ))}
      </div>

      {owned.length === 0 && (
        <div className="empty-state">
          <div className="icon">🧴</div>
          아직 보유 도료가 없습니다
        </div>
      )}

      {owned.map((p) => (
        <div className="paint-row" key={p.id} onClick={() => openEdit(p)}>
          <PaintCap manufacturer={p.manufacturer} size="lg" />
          <div className="paint-info">
            <div className="paint-code">
              <span className="code-text">{p.code}</span> <span className="text-dim">{p.name}</span>
            </div>
            <div className="paint-kits">
              {p.manufacturer} · {p.paintType}
              {p.note && ` · ${p.note}`}
            </div>
          </div>
        </div>
      ))}

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">{editing === 'new' ? '보유 도료 추가' : '보유 도료 수정'}</div>
            <PaintFormFields value={form} onChange={setForm} />
            <div className="modal-actions">
              {editing !== 'new' && (
                <button className="btn danger" onClick={markUnowned}>
                  보유 해제
                </button>
              )}
              <button className="btn" onClick={() => setEditing(null)}>
                취소
              </button>
              <button className="btn primary" onClick={save}>
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
