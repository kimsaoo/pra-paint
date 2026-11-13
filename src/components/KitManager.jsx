import { useMemo, useState } from 'react';
import { addItem, updateItem, deleteItem } from '../lib/useCollection';
import { BrandChip, OwnedBadge, AcquiredBadge, PaintCap, SimilarTooltip, WishlistToggle, ColorSwatch } from './Common';
import PaintEditModal from './PaintEditModal';
import ImagePaintImport from './ImagePaintImport';
import KitFormModal, { emptyKitForm, newKitForm, kitFormFromKit, kitDataFromForm } from './KitFormModal';
import { KIT_STATUSES, PRODUCT_TYPES, BUILD_LOCATIONS, normalizeKitStatus } from '../lib/constants';
import { getSimilarPaints } from '../lib/matching';

export default function KitManager({ kits, kitPaintLinks, paints, byId, kitManufacturers = [], paintManufacturers = [] }) {
  const iconByManufacturer = new Map(paintManufacturers.map((m) => [m.name, m.iconUrl]));
  const kitIconByManufacturer = new Map(kitManufacturers.map((m) => [m.name, m.iconUrl]));
  const [editingKit, setEditingKit] = useState(null); // null | 'new' | kit
  const [kitForm, setKitForm] = useState(emptyKitForm);
  const [expandedKitId, setExpandedKitId] = useState(null);
  const [addMode, setAddMode] = useState(null); // null | 'search' | 'new'
  const [searchQuery, setSearchQuery] = useState('');
  const [editingPaintId, setEditingPaintId] = useState(null);
  // paint 객체를 그대로 저장하지 않고 id로만 추적 → Firestore 실시간 업데이트가
  // 모달에 즉시 반영됨 (유사도료 검증/삭제 버튼이 반응 없는 것처럼 보이던 문제 수정)
  const editingPaint = editingPaintId ? byId.get(editingPaintId) || null : null;

  // 목록 필터와 정렬
  const [statusFilter, setStatusFilter] = useState('제작계획');
  const [typeFilter, setTypeFilter] = useState('');
  const [locFilter, setLocFilter] = useState('');
  const [onlyCheck, setOnlyCheck] = useState(false);
  const [textFilter, setTextFilter] = useState('');
  const [sortKey, setSortKey] = useState('priority');

  function openNewKit() {
    setKitForm(newKitForm());
    setEditingKit('new');
  }
  function openEditKit(kit) {
    setKitForm(kitFormFromKit(kit));
    setEditingKit(kit);
  }
  async function saveKit() {
    if (!kitForm.name.trim() || !kitForm.manufacturer || !kitForm.productType) return;
    const data = kitDataFromForm(kitForm); // scaleCustom 등 UI 상태 제거, 숫자 칸 변환
    if (editingKit === 'new') {
      await addItem('kits', { ...data, order: kits.length });
    } else {
      await updateItem('kits', editingKit.id, data);
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

  const statusCounts = KIT_STATUSES.reduce((m, st) => ((m[st] = kits.filter((k) => normalizeKitStatus(k.status) === st).length), m), {});
  const checkCount = kits.filter((k) => k.importCheck?.length).length;

  const numOr = (v, d) => (typeof v === 'number' && !isNaN(v) ? v : d);
  const sorters = {
    priority: (a, b) => numOr(a.priority, 9999) - numOr(b.priority, 9999) || (a.order ?? 0) - (b.order ?? 0),
    purchaseDesc: (a, b) => String(b.purchaseDate || '').localeCompare(String(a.purchaseDate || '')),
    purchaseAsc: (a, b) => String(a.purchaseDate || '').localeCompare(String(b.purchaseDate || '')),
    difficulty: (a, b) => numOr(a.difficulty, 9999) - numOr(b.difficulty, 9999),
    name: (a, b) => a.name.localeCompare(b.name),
  };
  const q = textFilter.trim().toLowerCase();
  const sortedKits = kits
    .filter((k) => !statusFilter || normalizeKitStatus(k.status) === statusFilter)
    .filter((k) => !typeFilter || k.productType === typeFilter)
    .filter((k) => !locFilter || k.buildLocation === locFilter)
    .filter((k) => !onlyCheck || k.importCheck?.length)
    .filter((k) => !q || [k.name, k.manufacturer, k.genreDetail, k.country].some((v) => String(v || '').toLowerCase().includes(q)))
    .sort(sorters[sortKey]);

  return (
    <div>
      <div className="flex-between">
        <div className="section-title">🏍️ 킷 관리 ({sortedKits.length}/{kits.length})</div>
        <button className="btn primary sm" onClick={openNewKit}>
          + 킷 추가
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '6px 0' }}>
        {KIT_STATUSES.map((st) => (
          <button key={st} className={`filter-chip ${statusFilter === st ? 'active' : ''}`} onClick={() => setStatusFilter(st)}>
            {st} {statusCounts[st]}
          </button>
        ))}
        <button className={`filter-chip ${statusFilter === '' ? 'active' : ''}`} onClick={() => setStatusFilter('')}>
          전체 {kits.length}
        </button>
        {checkCount > 0 && (
          <button className={`filter-chip ${onlyCheck ? 'active' : ''}`} onClick={() => setOnlyCheck(!onlyCheck)}>
            ⚠ 확인 필요 {checkCount}
          </button>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        <input style={{ flex: '1 1 140px' }} value={textFilter} onChange={(e) => setTextFilter(e.target.value)} placeholder="품명, 제조사, 장르 상세, 국가 검색" />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">장르 전체</option>
          {PRODUCT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select value={locFilter} onChange={(e) => setLocFilter(e.target.value)}>
          <option value="">위치 전체</option>
          {BUILD_LOCATIONS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
          <option value="priority">우선순</option>
          <option value="purchaseDesc">최근 구매순</option>
          <option value="purchaseAsc">오래된 구매순</option>
          <option value="difficulty">난이도 낮은순</option>
          <option value="name">이름순</option>
        </select>
      </div>

      {sortedKits.map((kit) => {
        const links = linksForKit(kit.id);
        const isExpanded = expandedKitId === kit.id;
        return (
          <div className="card" key={kit.id}>
            <div className="flex-between" onClick={() => setExpandedKitId(isExpanded ? null : kit.id)} style={{ cursor: 'pointer' }}>
              <div>
                <div className="code-text" style={{ fontSize: 14 }}>
                  {kit.importCheck?.length > 0 && <span title={kit.importCheck.join('\n')}>⚠ </span>}
                  {kit.name}
                </div>
                <div className="text-faint mt-4" style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                  {kit.manufacturer && (
                    <PaintCap manufacturer={kit.manufacturer} iconUrl={kitIconByManufacturer.get(kit.manufacturer)} />
                  )}
                  {[
                    kit.manufacturer,
                    kit.genreDetail || kit.productType,
                    kit.scale,
                    kit.country,
                    kit.buildLocation,
                    normalizeKitStatus(kit.status),
                    typeof kit.priority === 'number' ? `우선 ${kit.priority}` : '',
                    `도료 ${links.length}개`,
                  ]
                    .filter(Boolean)
                    .join(' / ')}
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
                        onClick={() => setEditingPaintId(p.id)}
                      >
                        <PaintCap manufacturer={p.manufacturer} iconUrl={iconByManufacturer.get(p.manufacturer)} />
                        <ColorSwatch name={p.name} />
                        <span className="code-text">{p.code}</span>
                        <span className="text-dim">{p.name}</span>
                        <OwnedBadge owned={p.owned} />
                        <AcquiredBadge paint={p} similarPaints={similar} />
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
          onClose={() => setEditingPaintId(null)}
        />
      )}

      {editingKit && (
        <KitFormModal
          form={kitForm}
          setForm={setKitForm}
          kitManufacturers={kitManufacturers}
          kits={kits}
          sourceKit={editingKit === 'new' ? null : editingKit}
          isNew={editingKit === 'new'}
          onCancel={() => setEditingKit(null)}
          onSave={saveKit}
          onDelete={() => removeKit(editingKit)}
        />
      )}
    </div>
  );
}
