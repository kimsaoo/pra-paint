import { useMemo, useState } from 'react';
import { computeItemMatch } from '../lib/matching';
import { addItem, updateItem, deleteItem } from '../lib/useCollection';
import { OwnedBadge, PaintCap } from './Common';

const emptyForm = {
  code: '',
  colorName: '',
  kitsNeeded: [],
  vallejoSimilar: '',
  migSimilar: '',
  akSimilar: '',
  vallejoVerified: true,
  migVerified: true,
  akVerified: true,
};

export default function MasterList({ tamiyaMaster, ownedOtherBrand, ownedAcrylic, kits }) {
  const [filterKit, setFilterKit] = useState('all');
  const [filterOwned, setFilterOwned] = useState('all');
  const [editing, setEditing] = useState(null); // null | 'new' | item
  const [form, setForm] = useState(emptyForm);

  const itemsWithMatch = useMemo(
    () =>
      tamiyaMaster
        .map((item) => ({ item, match: computeItemMatch(item, ownedOtherBrand, ownedAcrylic) }))
        .sort((a, b) => (a.item.code || '').localeCompare(b.item.code || '')),
    [tamiyaMaster, ownedOtherBrand, ownedAcrylic]
  );

  const filtered = itemsWithMatch.filter(({ item, match }) => {
    if (filterKit !== 'all' && !item.kitsNeeded?.includes(filterKit)) return false;
    if (filterOwned === 'owned' && match.ownedStatus !== '보유') return false;
    if (filterOwned === 'missing' && match.ownedStatus !== '미보유') return false;
    return true;
  });

  function openNew() {
    setForm(emptyForm);
    setEditing('new');
  }

  function openEdit(item) {
    setForm({
      code: item.code || '',
      colorName: item.colorName || '',
      kitsNeeded: item.kitsNeeded || [],
      vallejoSimilar: item.vallejoSimilar || '',
      migSimilar: item.migSimilar || '',
      akSimilar: item.akSimilar || '',
      vallejoVerified: item.vallejoVerified !== false,
      migVerified: item.migVerified !== false,
      akVerified: item.akVerified !== false,
    });
    setEditing(item);
  }

  async function save() {
    if (!form.code.trim()) return;
    if (editing === 'new') {
      await addItem('tamiyaMaster', form);
    } else {
      await updateItem('tamiyaMaster', editing.id, form);
    }
    setEditing(null);
  }

  async function remove(item) {
    if (!confirm(`"${item.code}" 항목을 삭제할까요?`)) return;
    await deleteItem('tamiyaMaster', item.id);
    setEditing(null);
  }

  function toggleKit(kitId) {
    setForm((f) => ({
      ...f,
      kitsNeeded: f.kitsNeeded.includes(kitId)
        ? f.kitsNeeded.filter((k) => k !== kitId)
        : [...f.kitsNeeded, kitId],
    }));
  }

  return (
    <div>
      <div className="flex-between">
        <div className="section-title">🗄️ 도료 DB ({tamiyaMaster.length})</div>
        <button className="btn primary sm" onClick={openNew}>
          + 추가
        </button>
      </div>

      <div className="filter-row">
        <button className={`filter-chip ${filterOwned === 'all' ? 'active' : ''}`} onClick={() => setFilterOwned('all')}>
          전체
        </button>
        <button className={`filter-chip ${filterOwned === 'owned' ? 'active' : ''}`} onClick={() => setFilterOwned('owned')}>
          보유
        </button>
        <button className={`filter-chip ${filterOwned === 'missing' ? 'active' : ''}`} onClick={() => setFilterOwned('missing')}>
          미보유
        </button>
        <button className={`filter-chip ${filterKit === 'all' ? 'active' : ''}`} onClick={() => setFilterKit('all')}>
          모든 킷
        </button>
        {kits.map((k) => (
          <button
            key={k.id}
            className={`filter-chip ${filterKit === k.id ? 'active' : ''}`}
            onClick={() => setFilterKit(k.id)}
          >
            {k.name}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="empty-state">
          <div className="icon">🗄️</div>
          조건에 맞는 도료가 없습니다
        </div>
      )}

      {filtered.map(({ item, match }) => (
        <div className="paint-row" key={item.id} onClick={() => openEdit(item)}>
          <PaintCap brand="tamiya" size="lg" />
          <div className="paint-info">
            <div className="paint-code">
              <span className="code-text">{item.code}</span>{' '}
              <span className="text-dim">{item.colorName}</span>
            </div>
            <div className="paint-kits">
              {item.kitsNeeded?.length > 0
                ? item.kitsNeeded.map((id) => kits.find((k) => k.id === id)?.name).filter(Boolean).join(', ')
                : '연결된 킷 없음'}
            </div>
          </div>
          <OwnedBadge owned={match.ownedStatus === '보유'} />
        </div>
      ))}

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">{editing === 'new' ? '도료 추가' : '도료 수정'}</div>

            <div className="field-group">
              <label>타미야 코드 (예: LP-5 (TS-29), XF-1)</label>
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div className="field-group">
              <label>색상명</label>
              <input value={form.colorName} onChange={(e) => setForm({ ...form, colorName: e.target.value })} />
            </div>
            <div className="field-group">
              <label>필요 킷</label>
              <div className="checkbox-grid">
                {kits.map((k) => (
                  <label className="checkbox-item" key={k.id}>
                    <input
                      type="checkbox"
                      checked={form.kitsNeeded.includes(k.id)}
                      onChange={() => toggleKit(k.id)}
                    />
                    {k.name}
                  </label>
                ))}
              </div>
            </div>
            <div className="field-group">
              <label>Vallejo 유사색 코드</label>
              <input
                value={form.vallejoSimilar}
                onChange={(e) => setForm({ ...form, vallejoSimilar: e.target.value })}
                placeholder="70.951 White"
              />
            </div>
            <div className="field-group">
              <label>MIG 유사색 코드</label>
              <input
                value={form.migSimilar}
                onChange={(e) => setForm({ ...form, migSimilar: e.target.value })}
                placeholder="MIG-0050 White"
              />
            </div>
            <div className="field-group">
              <label>AK 유사색 코드</label>
              <input
                value={form.akSimilar}
                onChange={(e) => setForm({ ...form, akSimilar: e.target.value })}
                placeholder="AK 11001 White"
              />
            </div>

            <div className="modal-actions">
              {editing !== 'new' && (
                <button className="btn danger" onClick={() => remove(editing)}>
                  삭제
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
