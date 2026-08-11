import { useState } from 'react';
import { addItem, updateItem, deleteItem } from '../lib/useCollection';

export default function KitManager({ kits, tamiyaMaster }) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  async function add() {
    if (!newName.trim()) return;
    await addItem('kits', { name: newName.trim(), order: kits.length });
    setNewName('');
  }

  function startEdit(kit) {
    setEditingId(kit.id);
    setEditName(kit.name);
  }

  async function saveEdit() {
    if (!editName.trim()) return;
    await updateItem('kits', editingId, { name: editName.trim() });
    setEditingId(null);
  }

  async function remove(kit) {
    const usedCount = tamiyaMaster.filter((t) => t.kitsNeeded?.includes(kit.id)).length;
    const msg =
      usedCount > 0
        ? `"${kit.name}"은 ${usedCount}개 도료에서 사용 중입니다. 삭제하면 해당 연결이 사라집니다. 계속할까요?`
        : `"${kit.name}"을 삭제할까요?`;
    if (!confirm(msg)) return;
    await deleteItem('kits', kit.id);
  }

  const sortedKits = [...kits].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <div>
      <div className="section-title">🏍️ 키트 관리 ({kits.length})</div>
      <p className="text-faint" style={{ marginBottom: 14 }}>
        키트를 추가/수정/삭제하면 도료 DB의 "필요 킷" 체크박스에 바로 반영됩니다.
      </p>

      <div className="card">
        <div className="field-group" style={{ marginBottom: 0 }}>
          <label>새 킷 추가</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="예: Honda RC213V'24"
              onKeyDown={(e) => e.key === 'Enter' && add()}
            />
            <button className="btn primary" onClick={add}>
              추가
            </button>
          </div>
        </div>
      </div>

      {sortedKits.map((kit) => {
        const usedCount = tamiyaMaster.filter((t) => t.kitsNeeded?.includes(kit.id)).length;
        return (
          <div className="paint-row" key={kit.id}>
            {editingId === kit.id ? (
              <>
                <input
                  style={{ flex: 1 }}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
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
                  <div className="paint-code">{kit.name}</div>
                  <div className="paint-kits">도료 {usedCount}개 연결됨</div>
                </div>
                <button className="icon-btn" onClick={() => startEdit(kit)}>
                  ✏️
                </button>
                <button className="icon-btn" onClick={() => remove(kit)}>
                  🗑️
                </button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
