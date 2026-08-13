import { useMemo, useState } from 'react';
import { PRODUCT_TYPES } from '../lib/constants';
import { addItem, updateItem, deleteItem } from '../lib/useCollection';
import { BrandChip, OwnedBadge, PaintCap, SimilarTooltip, WishlistToggle, ColorSwatch } from './Common';
import PaintEditModal from './PaintEditModal';
import ImagePaintImport from './ImagePaintImport';
import { getSimilarPaints } from '../lib/matching';

const emptyKitForm = { name: '', manufacturer: '', productType: '' };

export default function KitManager({ kits, kitPaintLinks, paints, byId, kitManufacturers = [], paintManufacturers = [] }) {
  const iconByManufacturer = new Map(paintManufacturers.map((m) => [m.name, m.iconUrl]));
  const [editingKit, setEditingKit] = useState(null); // null | 'new' | kit
  const [kitForm, setKitForm] = useState(emptyKitForm);
  const [expandedKitId, setExpandedKitId] = useState(null);
  const [addMode, setAddMode] = useState(null); // null | 'search' | 'new'
  const [searchQuery, setSearchQuery] = useState('');
  const [editingPaint, setEditingPaint] = useState(null);

  function openNewKit() {
    setKitForm(emptyKitForm);
    setEditingKit('new');
  }
  function openEditKit(kit) {
    setKitForm({ name: kit.name, manufacturer: kit.manufacturer || '', productType: kit.productType || '' });
    setEditingKit(kit);
  }
  async function saveKit() {
    if (!kitForm.name.trim() || !kitForm.manufacturer || !kitForm.productType) return;
    if (editingKit === 'new') {
      await addItem('kits', { ...kitForm, name: kitForm.name.trim(), order: kits.length });
    } else {
      await updateItem('kits', editingKit.id, kitForm);
    }
    setEditingKit(null);
  }
  async function removeKit(kit) {
    const linked = kitPaintLinks.filter((l) => l.kitId === kit.id);
    if (!confirm(`"${kit.name}"을 삭제할까요? 연결된 도료 요구사항 ${linked.length}건도 함께 삭제됩니다.`)) return;
    for (const l of linked) await deleteItem('kitPaintLinks', l.id);
    await deleteItem('kits', kit.id);
    setEditingKit(null);
  }

  function linksForKit(kitId) {
    return kitPaintLinks.filter((l) => l.kitId === kitId);
  }

  const searchCandidates = useMemo(() => {
    if (!searchQuery.trim() || !expandedKitId) return [];
    const q = searchQuery.trim().toLowerCase();
    const linkedPaintIds = new Set(linksForKit(expandedKitId).map((l) => l.paintId));
    return paints
      .filter((p) => !linkedPaintIds.has(p.id))
      .filter((p) => p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [searchQuery, paints, kitPaintLinks, expandedKitId]);

  async function attachPaint(kitId, paintId) {
    await addItem('kitPaintLinks', { kitId, paintId, source: 'manual' });
    setSearchQuery('');
    setAddMode(null);
  }

  async function detachLink(link) {
    await deleteItem('kitPaintLinks', link.id);
  }

  function handleNewPaintSaved(kitId, savedPaint) {
    if (savedPaint) attachPaint(kitId, savedPaint.id);
    setAddMode(null);
  }

  async function handleImageImportConfirm(kitId, createdPaints) {
    for (const p of createdPaints) {
      await addItem('kitPaintLinks', { kitId, paintId: p.id, source: 'image' });
    }
    setAddMode(null);
  }

  const sortedKits = [...kits].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <div>
      <div className="flex-between">
        <div className="section-title">🏍️ 킷 관리 ({kits.length})</div>
        <button className="btn primary sm" onClick={openNewKit}>
          + 킷 추가
        </button>
      </div>

      {sortedKits.map((kit) => {
        const links = linksForKit(kit.id);
        const isExpanded = expandedKitId === kit.id;
        return (
          <div className="card" key={kit.id}>
            <div className="flex-between" onClick={() => setExpandedKitId(isExpanded ? null : kit.id)} style={{ cursor: 'pointer' }}>
              <div>
                <div className="code-text" style={{ fontSize: 14 }}>
                  {kit.name}
                </div>
                <div className="text-faint mt-4">
                  {kit.manufacturer} · {kit.productType} · 도료 {links.length}개
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="icon-btn" onClick={(e) => { e.stopPropagation(); openEditKit(kit); }}>
                  ✏️
                </button>
                <span className="icon-btn">{isExpanded ? '▲' : '▼'}</span>
              </div>
            </div>

            {isExpanded && (
              <div className="mt-8">
                {links.length === 0 && <div className="text-faint mt-4">아직 등록된 도료가 없습니다</div>}
                {links.map((link) => {
                  const p = byId.get(link.paintId);
                  if (!p) return null;
                  const similar = getSimilarPaints(p, byId);
                  return (
                    <div className="flex-between mt-4" key={link.id}>
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', cursor: 'pointer' }}
                        onClick={() => setEditingPaint(p)}
                      >
                        <PaintCap manufacturer={p.manufacturer} iconUrl={iconByManufacturer.get(p.manufacturer)} />
                        <ColorSwatch name={p.name} />
                        <span className="code-text">{p.code}</span>
                        <span className="text-dim">{p.name}</span>
                        <OwnedBadge owned={p.owned} />
                        <SimilarTooltip similarPaints={similar} />
                        {!p.owned && (
                          <WishlistToggle paint={p} onToggle={(paint, v) => updateItem('paints', paint.id, { wishlisted: v })} />
                        )}
                      </div>
                      <button className="icon-btn" onClick={() => detachLink(link)}>
                        ✕
                      </button>
                    </div>
                  );
                })}

                {addMode === 'search' && (
                  <div className="mt-8">
                    <input
                      placeholder="코드/이름으로 검색"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      autoFocus
                    />
                    {searchCandidates.map((c) => (
                      <div className="flex-between mt-4" key={c.id}>
                        <BrandChip manufacturer={c.manufacturer}>
                          {c.code} {c.name}
                        </BrandChip>
                        <button className="btn sm primary" onClick={() => attachPaint(kit.id, c.id)}>
                          연결
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {addMode === 'new' && (
                  <PaintEditModal
                    paint={null}
                    allPaints={paints}
                    byId={byId}
                    manufacturers={paintManufacturers.map((m) => m.name)}
                    manufacturerIcons={iconByManufacturer}
                    onClose={(saved) => handleNewPaintSaved(kit.id, saved)}
                  />
                )}

                {addMode === 'image' && (
                  <ImagePaintImport
                    paints={paints}
                    manufacturers={paintManufacturers.map((m) => m.name)}
                    manufacturerIcons={iconByManufacturer}
                    onCancel={() => setAddMode(null)}
                    onConfirm={(created) => handleImageImportConfirm(kit.id, created)}
                  />
                )}

                {!addMode && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                    <button className="btn sm" onClick={() => setAddMode('search')}>
                      기존 도료 연결
                    </button>
                    <button className="btn sm" onClick={() => setAddMode('new')}>
                      새 도료 만들기
                    </button>
                    <button className="btn sm" onClick={() => setAddMode('image')}>
                      📷 이미지로 등록
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {editingPaint && (
        <PaintEditModal
          paint={editingPaint}
          allPaints={paints}
          byId={byId}
          manufacturers={paintManufacturers.map((m) => m.name)}
                    manufacturerIcons={iconByManufacturer}
          onClose={() => setEditingPaint(null)}
        />
      )}

      {editingKit && (
        <div className="modal-overlay" onClick={() => setEditingKit(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">{editingKit === 'new' ? '킷 추가' : '킷 수정'}</div>
            <div className="field-group">
              <label>제조사 *</label>
              <select value={kitForm.manufacturer} onChange={(e) => setKitForm({ ...kitForm, manufacturer: e.target.value })}>
                <option value="">선택</option>
                {kitManufacturers.map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field-group">
              <label>제품 타입 *</label>
              <select value={kitForm.productType} onChange={(e) => setKitForm({ ...kitForm, productType: e.target.value })}>
                <option value="">선택</option>
                {PRODUCT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="field-group">
              <label>제품명 *</label>
              <input value={kitForm.name} onChange={(e) => setKitForm({ ...kitForm, name: e.target.value })} />
            </div>
            <div className="modal-actions">
              {editingKit !== 'new' && (
                <button className="btn danger" onClick={() => removeKit(editingKit)}>
                  삭제
                </button>
              )}
              <button className="btn" onClick={() => setEditingKit(null)}>
                취소
              </button>
              <button className="btn primary" onClick={saveKit}>
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
