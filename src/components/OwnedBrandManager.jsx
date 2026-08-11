import { useMemo, useState } from 'react';
import { ACRYLIC_BRANDS, OTHER_BRANDS } from '../lib/constants';
import { addItem, deleteItem, updateItem } from '../lib/useCollection';
import { BrandChip } from './Common';

export default function OwnedBrandManager({ ownedAcrylic, ownedOtherBrand }) {
  const [activeBrand, setActiveBrand] = useState('vallejo');
  const [newText, setNewText] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');

  const allBrands = [...ACRYLIC_BRANDS, ...OTHER_BRANDS];
  const isAcrylic = ACRYLIC_BRANDS.some((b) => b.key === activeBrand);
  const collectionName = isAcrylic ? 'ownedAcrylic' : 'ownedOtherBrand';
  const sourceList = isAcrylic ? ownedAcrylic : ownedOtherBrand;

  const items = useMemo(
    () => sourceList.filter((o) => o.brand === activeBrand).sort((a, b) => (a.text || '').localeCompare(b.text || '')),
    [sourceList, activeBrand]
  );

  async function add() {
    if (!newText.trim()) return;
    await addItem(collectionName, { brand: activeBrand, text: newText.trim() });
    setNewText('');
  }

  function startEdit(item) {
    setEditingId(item.id);
    setEditText(item.text);
  }

  async function saveEdit() {
    if (!editText.trim()) return;
    await updateItem(collectionName, editingId, { text: editText.trim() });
    setEditingId(null);
  }

  async function remove(item) {
    if (!confirm(`"${item.text}" 항목을 삭제할까요?`)) return;
    await deleteItem(collectionName, item.id);
  }

  return (
    <div>
      <div className="section-title">🧴 보유 도료 관리</div>

      <div className="filter-row">
        {allBrands.map((b) => (
          <button
            key={b.key}
            className={`filter-chip ${activeBrand === b.key ? 'active' : ''}`}
            onClick={() => setActiveBrand(b.key)}
          >
            {b.label}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="field-group" style={{ marginBottom: 0 }}>
          <label>
            <BrandChip brand={activeBrand} /> 새 항목 추가
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder={
                isAcrylic ? '예: 70.951 Flat White' : '예: XF-1 Flat Black'
              }
              onKeyDown={(e) => e.key === 'Enter' && add()}
            />
            <button className="btn primary" onClick={add}>
              추가
            </button>
          </div>
        </div>
      </div>

      <div className="text-faint mt-4" style={{ marginBottom: 8 }}>
        총 {items.length}개
      </div>

      {items.map((item) => (
        <div className="paint-row" key={item.id}>
          {editingId === item.id ? (
            <>
              <input
                style={{ flex: 1 }}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                autoFocus
              />
              <button className="btn sm primary" onClick={saveEdit}>
                저장
              </button>
              <button className="btn sm" onClick={() => setEditingId(null)}>
                취소
              </button>
            </>
          ) : (
            <>
              <div className="paint-info">
                <div className="code-text" style={{ fontSize: 13 }}>
                  {item.text}
                </div>
              </div>
              <button className="icon-btn" onClick={() => startEdit(item)}>
                ✏️
              </button>
              <button className="icon-btn" onClick={() => remove(item)}>
                🗑️
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
