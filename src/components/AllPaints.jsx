import { useMemo, useState } from 'react';
import { PAINT_TYPES } from '../lib/constants';
import { PaintCap, WishlistToggle, ColorSwatch } from './Common';
import { updateItem } from '../lib/useCollection';
import PaintEditModal from './PaintEditModal';
import NormalizeCleanupModal from './NormalizeCleanupModal';

export default function AllPaints({ paints, byId, manufacturers = [], kitPaintLinks = [] }) {
  const [filterManufacturer, setFilterManufacturer] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterOwned, setFilterOwned] = useState('all');
  const [editing, setEditing] = useState(null); // null | 'closed' | paint | 'new'
  const [query, setQuery] = useState('');
  const [showCleanup, setShowCleanup] = useState(false);

  const filtered = useMemo(() => {
    return paints
      .filter((p) => filterManufacturer === 'all' || p.manufacturer === filterManufacturer)
      .filter((p) => filterType === 'all' || p.paintType === filterType)
      .filter((p) => filterOwned === 'all' || (filterOwned === 'owned' ? p.owned : !p.owned))
      .filter((p) => !query.trim() || p.code.toLowerCase().includes(query.toLowerCase()) || p.name.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => a.manufacturer.localeCompare(b.manufacturer) || a.code.localeCompare(b.code));
  }, [paints, filterManufacturer, filterType, filterOwned, query]);

  const activeFilterCount = [filterManufacturer !== 'all', filterType !== 'all', filterOwned !== 'all'].filter(Boolean).length;

  function resetFilters() {
    setFilterManufacturer('all');
    setFilterType('all');
    setFilterOwned('all');
  }

  async function toggleOwned(paint) {
    await updateItem('paints', paint.id, { owned: !paint.owned });
  }

  async function toggleWishlist(paint, value) {
    await updateItem('paints', paint.id, { wishlisted: value });
  }

  return (
    <div>
      <div className="flex-between">
        <div className="section-title">🗄️ 도료 ({paints.length})</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn sm" onClick={() => setShowCleanup(true)}>
            🧹 정리
          </button>
          <button className="btn primary sm" onClick={() => setEditing('new')}>
            + 추가
          </button>
        </div>
      </div>

      <div className="search-bar">
        <input placeholder="코드/이름 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div className="filter-panel">
        <div className="filter-group">
          <span className="filter-group-label">제조사</span>
          <select value={filterManufacturer} onChange={(e) => setFilterManufacturer(e.target.value)}>
            <option value="all">전체 제조사</option>
            {manufacturers
              .map((m) => m.name)
              .sort()
              .map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
          </select>
        </div>

        <div className="filter-group">
          <span className="filter-group-label">도료 타입</span>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="all">전체 타입</option>
            {PAINT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <span className="filter-group-label">보유여부</span>
          <div className="segmented">
            <button className={filterOwned === 'all' ? 'active' : ''} onClick={() => setFilterOwned('all')}>
              전체
            </button>
            <button className={filterOwned === 'owned' ? 'active' : ''} onClick={() => setFilterOwned('owned')}>
              보유
            </button>
            <button className={filterOwned === 'missing' ? 'active' : ''} onClick={() => setFilterOwned('missing')}>
              미보유
            </button>
          </div>
        </div>
      </div>

      <div className="filter-summary">
        {filtered.length}개 표시 중
        {activeFilterCount > 0 && (
          <>
            {' '}(조건 {activeFilterCount}개 적용)
            <button onClick={resetFilters}>초기화</button>
          </>
        )}
      </div>

      {filtered.length === 0 && (
        <div className="empty-state">
          <div className="icon">🗄️</div>
          조건에 맞는 도료가 없습니다
        </div>
      )}

      <div className="paint-grid-2col">
        {filtered.map((p) => (
          <div className="paint-row" key={p.id}>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, cursor: 'pointer', minWidth: 0 }}
              onClick={() => setEditing(p)}
            >
              <PaintCap manufacturer={p.manufacturer} size="lg" />
              <ColorSwatch name={p.name} size="lg" />
              <div className="paint-info">
                <div className="paint-code">
                  <span className="code-text">{p.code}</span> <span className="text-dim">{p.name}</span>
                </div>
                <div className="paint-kits">
                  {p.manufacturer} · {p.paintType}
                  {p.similarLinks?.length > 0 && ` · 유사도료 ${p.similarLinks.length}개`}
                </div>
              </div>
            </div>
            <button
              className={`btn sm ${p.owned ? 'primary' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleOwned(p);
              }}
            >
              {p.owned ? '● 보유' : '○ 미보유'}
            </button>
            <WishlistToggle paint={p} onToggle={toggleWishlist} />
          </div>
        ))}
      </div>

      {editing && (
        <PaintEditModal
          paint={editing === 'new' ? null : editing}
          allPaints={paints}
          byId={byId}
          manufacturers={manufacturers.map((m) => m.name)}
          onClose={() => setEditing(null)}
        />
      )}

      {showCleanup && (
        <NormalizeCleanupModal paints={paints} kitPaintLinks={kitPaintLinks} onClose={() => setShowCleanup(false)} />
      )}
    </div>
  );
}
