import { useMemo, useState } from 'react';
import { updateItem } from '../lib/useCollection';
import { BrandChip } from './Common';

export default function UnverifiedCodes({ tamiyaMaster }) {
  const [editing, setEditing] = useState(null); // { itemId, field }
  const [editValue, setEditValue] = useState('');

  const unverifiedItems = useMemo(() => {
    return tamiyaMaster.filter(
      (item) =>
        item.vallejoVerified === false ||
        item.migVerified === false ||
        item.akVerified === false
    );
  }, [tamiyaMaster]);

  function startEdit(item, field) {
    setEditing({ itemId: item.id, field });
    setEditValue(item[field] || '');
  }

  async function saveEdit(item) {
    await updateItem('tamiyaMaster', item.id, { [editing.field]: editValue });
    setEditing(null);
  }

  async function markVerified(item, field) {
    await updateItem('tamiyaMaster', item.id, { [field]: true });
  }

  return (
    <div>
      <div className="section-title">⚠️ 미검증 코드 관리 ({unverifiedItems.length})</div>
      <p className="text-faint" style={{ marginBottom: 14 }}>
        Gemini가 처음 제안한 값 그대로라 아직 색상 정확도를 확인하지 못한 MIG/AK 코드입니다.
        확인 후 코드를 수정하거나 "검증완료"로 표시하세요.
      </p>

      {unverifiedItems.length === 0 && (
        <div className="empty-state">
          <div className="icon">✅</div>
          미검증 항목이 없습니다
        </div>
      )}

      {unverifiedItems.map((item) => (
        <div className="card" key={item.id}>
          <div>
            <span className="code-text">{item.code}</span>{' '}
            <span className="text-dim">{item.colorName}</span>
          </div>

          {item.vallejoVerified === false && (
            <div className="flex-between mt-8">
              <div style={{ flex: 1 }}>
                <span className="badge unverified">Vallejo 미검증</span>{' '}
                {editing?.itemId === item.id && editing.field === 'vallejoSimilar' ? (
                  <input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveEdit(item)}
                    autoFocus
                    style={{ width: '60%', marginTop: 6 }}
                  />
                ) : (
                  <BrandChip brand="vallejo">{item.vallejoSimilar}</BrandChip>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {editing?.itemId === item.id && editing.field === 'vallejoSimilar' ? (
                  <button className="btn sm primary" onClick={() => saveEdit(item)}>
                    저장
                  </button>
                ) : (
                  <>
                    <button className="btn sm" onClick={() => startEdit(item, 'vallejoSimilar')}>
                      수정
                    </button>
                    <button className="btn sm primary" onClick={() => markVerified(item, 'vallejoVerified')}>
                      검증완료
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {item.migVerified === false && (
            <div className="flex-between mt-8">
              <div style={{ flex: 1 }}>
                <span className="badge unverified">MIG 미검증</span>{' '}
                {editing?.itemId === item.id && editing.field === 'migSimilar' ? (
                  <input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveEdit(item)}
                    autoFocus
                    style={{ width: '60%', marginTop: 6 }}
                  />
                ) : (
                  <BrandChip brand="mig">{item.migSimilar}</BrandChip>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {editing?.itemId === item.id && editing.field === 'migSimilar' ? (
                  <button className="btn sm primary" onClick={() => saveEdit(item)}>
                    저장
                  </button>
                ) : (
                  <>
                    <button className="btn sm" onClick={() => startEdit(item, 'migSimilar')}>
                      수정
                    </button>
                    <button className="btn sm primary" onClick={() => markVerified(item, 'migVerified')}>
                      검증완료
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {item.akVerified === false && (
            <div className="flex-between mt-8">
              <div style={{ flex: 1 }}>
                <span className="badge unverified">AK 미검증</span>{' '}
                {editing?.itemId === item.id && editing.field === 'akSimilar' ? (
                  <input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveEdit(item)}
                    autoFocus
                    style={{ width: '60%', marginTop: 6 }}
                  />
                ) : (
                  <BrandChip brand="ak">{item.akSimilar}</BrandChip>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {editing?.itemId === item.id && editing.field === 'akSimilar' ? (
                  <button className="btn sm primary" onClick={() => saveEdit(item)}>
                    저장
                  </button>
                ) : (
                  <>
                    <button className="btn sm" onClick={() => startEdit(item, 'akSimilar')}>
                      수정
                    </button>
                    <button className="btn sm primary" onClick={() => markVerified(item, 'akVerified')}>
                      검증완료
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
