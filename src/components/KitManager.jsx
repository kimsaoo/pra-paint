import { useMemo, useState } from 'react';
import { DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { writeBatch, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { addItem, updateItem, deleteItem } from '../lib/useCollection';
import { BrandChip, OwnedBadge, AcquiredBadge, PaintCap, SimilarTooltip, WishlistToggle, ColorSwatch } from './Common';
import PaintEditModal from './PaintEditModal';
import ImagePaintImport from './ImagePaintImport';
import KitFormModal, { emptyKitForm, newKitForm, kitFormFromKit, kitDataFromForm } from './KitFormModal';
import { KIT_STATUSES, PRODUCT_TYPES, BUILD_LOCATIONS, normalizeKitStatus, showsPriority } from '../lib/constants';
import { getSimilarPaints } from '../lib/matching';
import { Box, AlertTriangle, MapPin, Pencil, ChevronDown, ChevronUp, X, Camera, Plus, GripVertical } from 'lucide-react';

const STATUS_CLASS = { 제작계획: 'plan', 작업중: 'wip', 촬영대기: 'photo', 제작완료: 'done' };

/** 드래그로 순서를 바꿀 수 있는 카드 래퍼. 손잡이(우선순위 칸)에만 드래그를 걸어 스크롤, 펼침과 충돌하지 않게 함 */
function SortableItem({ id, disabled, children }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const style = { transform: CSS.Translate.toString(transform), transition, zIndex: isDragging ? 5 : undefined, position: 'relative' };
  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'kit-dragging' : ''}>
      {children({ handleRef: setActivatorNodeRef, handleProps: disabled ? {} : { ...attributes, ...listeners } })}
    </div>
  );
}

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
    if (data.importCheck?.length && confirm('이 킷의 "확인 필요" 표시도 지울까요?\n(내용을 확인했다면 확인, 나중에 다시 볼 거라면 취소)')) {
      data.importCheck = [];
    }
    if (editingKit === 'new' && data.status === '제작계획' && data.priority == null) {
      const maxPrio = kits
        .filter((k) => normalizeKitStatus(k.status) === '제작계획' && typeof k.priority === 'number')
        .reduce((m, k) => Math.max(m, k.priority), 0);
      data.priority = maxPrio + 1; // 새 계획 킷은 맨 뒤 순서로
    }
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

  function acquisitionOf(links) {
    let ok = 0;
    let total = 0;
    for (const l of links) {
      const p = byId.get(l.paintId);
      if (!p) continue;
      total++;
      if (p.owned || getSimilarPaints(p, byId).some((x) => x.owned)) ok++;
    }
    return { ok, total };
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

  // 드래그 재정렬: "제작계획" + "우선순" 정렬 + 다른 필터 없음일 때만 (일부만 보이는 상태에서 번호를 다시 매기면 꼬이므로)
  const filtersActive = !!(typeFilter || locFilter || onlyCheck || textFilter.trim());
  const dragEnabled = statusFilter === '제작계획' && sortKey === 'priority' && !filtersActive;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [savingOrder, setSavingOrder] = useState(false);

  async function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return;
    const ids = sortedKits.map((k) => k.id);
    const next = arrayMove(ids, ids.indexOf(active.id), ids.indexOf(over.id));
    // 제작계획 킷 전체에 1부터 다시 번호를 매김 (바뀐 킷만 기록)
    const batch = writeBatch(db);
    let changed = 0;
    next.forEach((id, i) => {
      const kit = kits.find((k) => k.id === id);
      if (kit && kit.priority !== i + 1) {
        batch.update(doc(db, 'kits', id), { priority: i + 1 });
        changed++;
      }
    });
    if (!changed) return;
    setSavingOrder(true);
    try {
      await batch.commit();
    } catch (err) {
      console.error(err);
      alert('순서 저장에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSavingOrder(false);
    }
  }

  return (
    <div>
      <div className="flex-between">
        <div className="section-title"><Box size={20} className="ico" aria-hidden="true" />킷 관리 <span className="title-count">{sortedKits.length}/{kits.length}</span></div>
        <button className="btn primary sm" onClick={openNewKit}>
          <Plus size={14} className="ico" aria-hidden="true" />킷 추가
        </button>
      </div>

      <div className="kit-summary">
        {KIT_STATUSES.map((st) => (
          <button key={st} className={`kit-stat ${statusFilter === st ? 'active' : ''}`} onClick={() => setStatusFilter(st)}>
            <span className="kit-stat-label">{st}</span>
            <span className="kit-stat-num">{statusCounts[st]}</span>
          </button>
        ))}
        <button className={`kit-stat ${statusFilter === '' ? 'active' : ''}`} onClick={() => setStatusFilter('')}>
          <span className="kit-stat-label">전체</span>
          <span className="kit-stat-num">{kits.length}</span>
        </button>
      </div>

      <div className="kit-toolbar">
        <input value={textFilter} onChange={(e) => setTextFilter(e.target.value)} placeholder="품명, 제조사, 장르 상세, 국가" />
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
        {checkCount > 0 && (
          <button className={`filter-chip ${onlyCheck ? 'active' : ''}`} onClick={() => setOnlyCheck(!onlyCheck)}>
            <AlertTriangle size={13} className="ico" aria-hidden="true" />확인 필요 {checkCount}
          </button>
        )}
      </div>

      {sortedKits.length === 0 && <div className="empty-state">조건에 맞는 킷이 없습니다. 필터를 바꾸거나 새 킷을 추가하세요.</div>}

      {statusFilter === '제작계획' && (
        <div className="drag-hint">
          <GripVertical size={14} className="ico" aria-hidden="true" />
          {dragEnabled
            ? savingOrder
              ? '순서 저장 중...'
              : '우선 칸을 끌어서 다음에 만들 순서를 바꿀 수 있습니다. (휴대폰은 길게 누른 뒤 끌기)'
            : '순서를 바꾸려면 정렬을 "우선순"으로 두고 검색, 장르, 위치, 확인 필요 필터를 해제하세요.'}
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sortedKits.map((k) => k.id)} strategy={rectSortingStrategy}>
      <div className="kit-list">
      {sortedKits.map((kit) => {
        const links = linksForKit(kit.id);
        const isExpanded = expandedKitId === kit.id;
        const acq = acquisitionOf(links);
        const st = normalizeKitStatus(kit.status);
        const meta = [
          [kit.manufacturer, kit.scale].filter(Boolean).join(' '),
          kit.country,
          kit.genreDetail || kit.productType,
        ].filter(Boolean);
        return (
          <SortableItem key={kit.id} id={kit.id} disabled={!dragEnabled || st !== '제작계획'}>
          {({ handleRef, handleProps }) => (
          <div className={`kit-card ${isExpanded ? 'expanded' : ''}`}>
            <div className="kit-card-main" onClick={() => setExpandedKitId(isExpanded ? null : kit.id)}>
              {showsPriority(st) && (
                <div
                  ref={handleRef}
                  {...handleProps}
                  className={`kit-prio ${typeof kit.priority === 'number' ? '' : 'none'} ${dragEnabled && st === '제작계획' ? 'draggable' : ''}`}
                  title={dragEnabled && st === '제작계획' ? '끌어서 순서 변경' : '다음에 만들 순서'}
                  onClick={(e) => dragEnabled && e.stopPropagation()}
                >
                  {dragEnabled && st === '제작계획' ? <GripVertical size={12} className="ico prio-grip" aria-hidden="true" /> : <small>우선</small>}
                  <b>{typeof kit.priority === 'number' ? kit.priority : '-'}</b>
                </div>
              )}
              <div className="kit-body">
                <div className="kit-title-row">
                  <div className="kit-title">{kit.name}</div>
                  <span className={`status-badge ${STATUS_CLASS[st] || 'plan'}`}>{st}</span>
                </div>
                <div className="kit-meta">
                  {kit.manufacturer && (
                    <PaintCap manufacturer={kit.manufacturer} iconUrl={kitIconByManufacturer.get(kit.manufacturer)} />
                  )}
                  {meta.map((m, i) => (
                    <span key={i}>
                      {i > 0 && <span className="sep">/ </span>}
                      {m}
                    </span>
                  ))}
                </div>
                <div className="kit-foot">
                  {acq.total > 0 ? (
                    <div className="acq" title="본인 보유 또는 유사도료 보유 기준">
                      <div className="acq-track">
                        <div className={`acq-fill ${acq.ok < acq.total ? 'partial' : ''}`} style={{ width: `${(acq.ok / acq.total) * 100}%` }} />
                      </div>
                      <span className="acq-label">
                        도료 확보 {acq.ok}/{acq.total}
                      </span>
                    </div>
                  ) : (
                    <span className="acq">
                      <span className="status-badge warn">도료 미등록</span>
                    </span>
                  )}
                  {kit.importCheck?.length > 0 && (
                    <span className="status-badge warn" title={kit.importCheck.join('\n')}>
                      <AlertTriangle size={12} className="ico" aria-hidden="true" />확인 필요
                    </span>
                  )}
                  {kit.buildLocation && <span className="kit-loc"><MapPin size={12} className="ico" aria-hidden="true" />{kit.buildLocation}</span>}
                </div>
              </div>
              <div className="kit-actions">
                <button className="icon-btn" aria-label="킷 수정" onClick={(e) => { e.stopPropagation(); openEditKit(kit); }}>
                  <Pencil size={16} className="ico" aria-hidden="true" />
                </button>
                <span className="icon-btn" aria-hidden="true">{isExpanded ? <ChevronUp size={18} className="ico" /> : <ChevronDown size={18} className="ico" />}</span>
              </div>
            </div>

            {isExpanded && (
              <div className="kit-detail">
                {links.length === 0 && <div className="text-faint mt-4">아직 등록된 도료가 없습니다</div>}
                {links.map((link) => {
                  const p = byId.get(link.paintId);
                  if (!p) return null;
                  const similar = getSimilarPaints(p, byId);
                  return (
                    <div className="kit-paint-row" key={link.id}>
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
                      <button className="icon-btn" aria-label="연결 해제" onClick={() => detachLink(link)}>
                        <X size={16} className="ico" aria-hidden="true" />
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
                      <Camera size={14} className="ico" aria-hidden="true" />이미지로 등록
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          )}
          </SortableItem>
        );
      })}

      </div>
      </SortableContext>
      </DndContext>

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
