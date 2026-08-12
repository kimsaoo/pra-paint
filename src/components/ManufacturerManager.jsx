import { useState } from 'react';
import { renamePaintManufacturer, renameKitManufacturer, addManufacturer, deleteManufacturer } from '../lib/manufacturerOps';

export default function ManufacturerManager({ paintManufacturers, kitManufacturers, paints, kits }) {
  const [tab, setTab] = useState('paint'); // 'paint' | 'kit'
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  const isPaint = tab === 'paint';
  const list = isPaint ? paintManufacturers : kitManufacturers;
  const collectionName = isPaint ? 'paintManufacturers' : 'kitManufacturers';
  const usageOf = (name) =>
    isPaint ? paints.filter((p) => p.manufacturer === name).length : kits.filter((k) => k.manufacturer === name).length;

  async function add() {
    if (!newName.trim()) return;
    await addManufacturer(collectionName, newName.trim());
    setNewName('');
  }

  function startEdit(m) {
    setEditingId(m.id);
    setEditName(m.name);
  }

  async function saveEdit(m) {
    if (!editName.trim() || editName.trim() === m.name) {
      setEditingId(null);
      return;
    }
    if (isPaint) {
      await renamePaintManufacturer(m.id, m.name, editName.trim(), paints);
    } else {
      await renameKitManufacturer(m.id, m.name, editName.trim(), kits);
    }
    setEditingId(null);
  }

  async function remove(m) {
    const count = usageOf(m.name);
    const msg =
      count > 0
        ? `"${m.name}"은 ${count}개 ${isPaint ? '도료' : '킷'}에서 사용 중입니다. 그래도 삭제할까요? (사용 중인 항목의 제조사 값은 그대로 "${m.name}" 텍스트로 남습니다)`
        : `"${m.name}"을 삭제할까요?`;
    if (!confirm(msg)) return;
    await deleteManufacturer(collectionName, m.id);
  }

  return (
    <div>
      <div className="section-title">🏷️ 제조사 관리</div>

      <div className="filter-row">
        <button className={`filter-chip ${tab === 'paint' ? 'active' : ''}`} onClick={() => setTab('paint')}>
          도료 제조사
        </button>
        <button className={`filter-chip ${tab === 'kit' ? 'active' : ''}`} onClick={() => setTab('kit')}>
          프라모델 제조사
        </button>
      </div>

      <div className="card">
        <div className="field-group" style={{ marginBottom: 0 }}>
          <label>새 제조사 추가</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={isPaint ? '예: Zero Paints' : '예: Revell'}
              onKeyDown={(e) => e.key === 'Enter' && add()}
            />
            <button className="btn primary" onClick={add}>
              추가
            </button>
          </div>
        </div>
      </div>

      {list
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((m) => (
          <div className="paint-row" key={m.id}>
            {editingId === m.id ? (
              <>
                <input
                  style={{ flex: 1 }}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveEdit(m)}
                  autoFocus
                />
                <button className="btn sm primary" onClick={() => saveEdit(m)}>
                  저장
                </button>
                <button className="btn sm" onClick={() => setEditingId(null)}>
                  취소
                </button>
              </>
            ) : (
              <>
                <div className="paint-info">
                  <div className="paint-code">{m.name}</div>
                  <div className="paint-kits">{usageOf(m.name)}개 사용 중</div>
                </div>
                <button className="icon-btn" onClick={() => startEdit(m)}>
                  ✏️
                </button>
                <button className="icon-btn" onClick={() => remove(m)}>
                  🗑️
                </button>
              </>
            )}
          </div>
        ))}
    </div>
  );
}
