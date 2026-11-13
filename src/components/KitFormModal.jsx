import { useState } from 'react';
import {
  PRODUCT_TYPES,
  COUNTRY_SUGGESTIONS,
  SCALE_PRESETS,
  DEFAULT_SCALE_BY_TYPE,
  SIZE_CLASSES,
  BUILD_LOCATIONS,
  KIT_STATUSES,
  FIGURE_STATUSES,
  normalizeKitStatus,
  showsPriority,
} from '../lib/constants';
import { searchKitDimensions, searchKitInfo } from '../lib/gemini';
import { AlertTriangle, Search, Ruler } from 'lucide-react';

function todayDot() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

export const emptyKitForm = {
  name: '',
  kitNumber: '',
  manufacturer: '',
  productType: '',
  genreDetail: '',
  country: '',
  scale: '',
  scaleCustom: false,
  sizeClass: '',
  dimensions: { width: '', length: '', height: '' },
  purchaseDate: '',
  difficulty: '',
  priority: '',
  markingChoice: '',
  figureChoice: '',
  figureStatus: '',
  paintAfterAssembly: '',
  special: '',
  buildLocation: '집', // 신규 킷 기본 위치
  status: '제작계획',
  importCheck: [],
};

export function newKitForm() {
  return { ...emptyKitForm, purchaseDate: todayDot() };
}

const numOrBlank = (v) => (v === null || v === undefined ? '' : String(v));

export function kitFormFromKit(kit) {
  return {
    name: kit.name || '',
    kitNumber: kit.kitNumber || '',
    manufacturer: kit.manufacturer || '',
    productType: kit.productType || '',
    genreDetail: kit.genreDetail || '',
    country: kit.country || '',
    scale: kit.scale || '',
    scaleCustom: !!kit.scale && !SCALE_PRESETS.includes(kit.scale),
    sizeClass: kit.sizeClass || '',
    dimensions: { width: '', length: '', height: '', ...(kit.dimensions || {}) },
    purchaseDate: kit.purchaseDate || '',
    difficulty: numOrBlank(kit.difficulty),
    priority: numOrBlank(kit.priority),
    markingChoice: kit.markingChoice || '',
    // 이전 버전의 figureNote도 피규어 선택으로 이어받음
    figureChoice: kit.figureChoice || kit.figureNote || '',
    figureStatus: kit.figureStatus || '',
    paintAfterAssembly: kit.paintAfterAssembly || '',
    special: kit.special || '',
    buildLocation: kit.buildLocation || '',
    status: normalizeKitStatus(kit.status),
    importCheck: kit.importCheck || [],
  };
}

/** 저장용 데이터: UI 전용 값 제거, 숫자 칸 변환 */
export function kitDataFromForm(form) {
  const { scaleCustom, ...data } = form;
  const toNum = (v) => (String(v).trim() === '' || isNaN(Number(v)) ? null : Number(v));
  return { ...data, name: form.name.trim(), difficulty: toNum(form.difficulty), priority: toNum(form.priority) };
}

// 유사 킷 복사 시 가져오는 항목 (분류 정보만. 품명, 구매일, 계획 관련 항목은 제외)
const COPY_FIELDS = ['manufacturer', 'productType', 'genreDetail', 'country', 'scale', 'sizeClass', 'buildLocation', 'paintAfterAssembly'];

function Section({ title, children, defaultOpen = true }) {
  return (
    <details className="form-section" open={defaultOpen}>
      <summary>{title}</summary>
      <div className="form-grid">{children}</div>
    </details>
  );
}

function AutoTag({ on }) {
  return on ? <span className="auto-tag">자동</span> : null;
}

export default function KitFormModal({ form, setForm, kitManufacturers, kits = [], sourceKit, onCancel, onSave, onDelete, isNew }) {
  const [dimLoading, setDimLoading] = useState(false);
  const [dimInfo, setDimInfo] = useState(null); // { text, sources }
  const [infoQuery, setInfoQuery] = useState('');
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoResult, setInfoResult] = useState(null); // { filled: [], kept: [], notes: [], sources: [] }
  const [autoFields, setAutoFields] = useState(new Set());
  const [copyFromId, setCopyFromId] = useState('');

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  function describeDims(result) {
    const label =
      result.source === 'kit'
        ? '킷 상품정보 기준'
        : result.source === 'mixed'
          ? '킷 상품정보 기준, 빠진 항목은 실물 크기를 스케일로 환산'
          : '실물 크기를 스케일로 환산';
    return { text: `${label}${result.note ? `: ${result.note}` : ''}`, sources: result.sources || [] };
  }

  function setProductType(pt) {
    setForm((f) => ({
      ...f,
      productType: pt,
      // 스케일을 아직 고르지 않았다면 제품타입 기본 스케일로 맞춤 (AERO는 기본값 없음)
      scale: f.scaleCustom || f.scale ? f.scale : DEFAULT_SCALE_BY_TYPE[pt] || '',
    }));
  }

  function setDim(field, value) {
    setForm((f) => ({ ...f, dimensions: { ...f.dimensions, [field]: value } }));
  }

  function copyFromKit(id) {
    setCopyFromId(id);
    const src = kits.find((k) => k.id === id);
    if (!src) return;
    const patch = {};
    for (const k of COPY_FIELDS) if (src[k]) patch[k] = src[k];
    if (patch.scale) patch.scaleCustom = !SCALE_PRESETS.includes(patch.scale);
    set(patch);
  }

  async function autoFillInfo() {
    const q = (infoQuery || form.name).trim();
    if (!q) {
      alert('품번 또는 품명을 입력해주세요. (예: 35165, 1/35 Tiger I Early)');
      return;
    }
    setInfoLoading(true);
    setInfoResult(null);
    try {
      const { fields: r, sources } = await searchKitInfo(form.manufacturer, q);
      const filled = [];
      const kept = [];
      const notes = [];
      const patch = {};
      const newAuto = new Set(autoFields);
      const put = (key, label, value) => {
        if (value === null || value === undefined || value === '') return;
        if (String(form[key] || '').trim() !== '') {
          if (String(form[key]) !== String(value)) kept.push(`${label}: 입력값 유지 (검색값 ${value})`);
          return;
        }
        patch[key] = value;
        newAuto.add(key);
        filled.push(`${label}: ${value}`);
      };

      put('name', '품명', r.name);
      put('kitNumber', '품번', r.kitNumber);
      if (r.manufacturer) {
        const hit = kitManufacturers.find((m) => m.name.toLowerCase() === String(r.manufacturer).toLowerCase());
        if (hit) put('manufacturer', '제조사', hit.name);
        else if (!form.manufacturer) notes.push(`제조사 "${r.manufacturer}"는 목록에 없습니다. 제조사 탭에서 추가 후 선택하세요.`);
      }
      if (PRODUCT_TYPES.includes(r.productType)) put('productType', '장르', r.productType);
      put('genreDetail', '장르 상세', r.genreDetail);
      put('country', '국가', r.country);
      if (r.scale && !form.scale) {
        patch.scale = r.scale;
        patch.scaleCustom = !SCALE_PRESETS.includes(r.scale);
        newAuto.add('scale');
        filled.push(`스케일: ${r.scale}`);
      }
      if (r.figureIncluded === true || r.figureIncluded === false) {
        const v = r.figureIncluded ? `동봉${r.figureNote ? ` (${r.figureNote})` : ''}` : 'X';
        put('figureChoice', '피규어', v);
      }
      const d = r.dimensions || {};
      const dims = { ...form.dimensions };
      const DIM_LABEL = { length: '길이', width: '너비', height: '높이' };
      const fillDims = (src) => {
        for (const k of ['length', 'width', 'height']) {
          if (src[k] == null) continue;
          if (String(dims[k] || '').trim() === '') {
            dims[k] = String(src[k]);
            filled.push(`${DIM_LABEL[k]}: ${src[k]}mm${src.calcKeys?.includes(k) ? ' (실물 환산)' : ''}`);
            newAuto.add(`dim_${k}`);
          }
        }
      };
      fillDims(d);
      // 킷 정보에 크기가 없으면 크기 전용 조사(킷 크기 → 없으면 실물 크기 ÷ 스케일)로 이어서 시도
      const dimsMissing = ['length', 'width', 'height'].some((k) => String(dims[k] || '').trim() === '');
      if (dimsMissing) {
        const eff = { ...form, ...patch };
        try {
          const dr = await searchKitDimensions(eff.manufacturer, eff.name || q, eff.scale);
          fillDims(dr);
          setDimInfo(describeDims(dr));
        } catch (e) {
          notes.push(`크기: ${e.message}`);
        }
      }
      patch.dimensions = dims;
      if (r.note) notes.push(r.note);

      setForm((f) => ({ ...f, ...patch }));
      setAutoFields(newAuto);
      setInfoResult({ filled, kept, notes, sources });
    } catch (err) {
      console.error(err);
      alert(err.message || '키트 정보 검색 중 오류가 발생했습니다.');
    } finally {
      setInfoLoading(false);
    }
  }

  async function autoFillDimensions() {
    if (!form.name.trim()) {
      alert('품명을 먼저 입력해주세요.');
      return;
    }
    const hasAny = ['length', 'width', 'height'].some((k) => String(form.dimensions[k] || '').trim() !== '');
    if (hasAny && !confirm('이미 입력된 크기가 있습니다. 조사 결과로 덮어쓸까요?')) return;
    setDimLoading(true);
    setDimInfo(null);
    try {
      const result = await searchKitDimensions(form.manufacturer, form.name, form.scale);
      setForm((f) => ({
        ...f,
        dimensions: {
          length: result.length != null ? String(result.length) : f.dimensions.length,
          width: result.width != null ? String(result.width) : f.dimensions.width,
          height: result.height != null ? String(result.height) : f.dimensions.height,
        },
      }));
      setAutoFields((prev) => new Set([...prev, 'dim_length', 'dim_width', 'dim_height']));
      setDimInfo(describeDims(result));
    } catch (err) {
      console.error(err);
      alert(err.message || '크기 조사 중 오류가 발생했습니다.');
    } finally {
      setDimLoading(false);
    }
  }

  const has = (k) => autoFields.has(k);

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{isNew ? '킷 추가' : '킷 수정'}</div>

        {form.importCheck?.length > 0 && (
          <div className="notice-warn">
            <div style={{ fontWeight: 600 }}><AlertTriangle size={14} className="ico" aria-hidden="true" />시트 이관 확인 필요</div>
            <ul style={{ margin: '6px 0', paddingLeft: 18, fontSize: 12 }}>
              {form.importCheck.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            {sourceKit?.dimensionsRaw && <div className="text-faint">크기 원문: {sourceKit.dimensionsRaw}</div>}
            {sourceKit?.sheetRaw && (
              <details style={{ fontSize: 12, marginTop: 4 }}>
                <summary>시트 원본 행 보기 ({sourceKit.sheet} {sourceKit.sheetRow}행)</summary>
                {Object.entries(sourceKit.sheetRaw).map(([k, v]) => (
                  <div key={k}>
                    <b>{k}</b>: {v}
                  </div>
                ))}
              </details>
            )}
            <button className="btn sm mt-4" onClick={() => set({ importCheck: [] })}>
              확인 완료로 표시
            </button>
          </div>
        )}

        <Section title="키트 정보">
          {isNew && kits.length > 0 && (
            <div className="field-group span-2">
              <label>비슷한 킷에서 복사</label>
              <select value={copyFromId} onChange={(e) => copyFromKit(e.target.value)}>
                <option value="">선택 안 함</option>
                {[...kits]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name}
                    </option>
                  ))}
              </select>
              <div className="text-faint mt-4">제조사, 장르, 장르 상세, 국가, 스케일, 크기, 위치, 조립후 도색가능을 가져옵니다.</div>
            </div>
          )}

          <div className="field-group span-2 lookup-box">
            <label><Search size={14} className="ico" aria-hidden="true" />품번 또는 품명으로 키트 정보 검색</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                style={{ flex: 1 }}
                value={infoQuery}
                onChange={(e) => setInfoQuery(e.target.value)}
                placeholder={form.name || '예: 35165 또는 1/35 Tiger I Early'}
              />
              <button className="btn sm primary" onClick={autoFillInfo} disabled={infoLoading}>
                {infoLoading ? '검색 중...' : '자동입력'}
              </button>
            </div>
            <div className="text-faint mt-4">제조사를 먼저 고르면 더 정확합니다. 비어 있는 칸만 채우고, 입력한 값은 바꾸지 않습니다. 크기는 킷 정보에 없으면 실물 크기를 스케일로 환산해 채웁니다.</div>
            {infoResult && (
              <div className="text-faint mt-4" style={{ fontSize: 12 }}>
                {infoResult.filled.length > 0 ? <div>채움: {infoResult.filled.join(', ')}</div> : <div>새로 채운 항목이 없습니다.</div>}
                {infoResult.kept.length > 0 && <div>유지: {infoResult.kept.join(', ')}</div>}
                {infoResult.notes.map((n) => (
                  <div key={n}>{n}</div>
                ))}
                {infoResult.sources.length > 0 && (
                  <div>
                    출처:{' '}
                    {infoResult.sources.map((s, i) => (
                      <a key={s.uri} href={s.uri} target="_blank" rel="noreferrer" style={{ marginRight: 6 }}>
                        [{i + 1}] {s.title}
                      </a>
                    ))}
                  </div>
                )}
                <div>검색 결과이니 저장 전에 확인해주세요.</div>
              </div>
            )}
          </div>

          <div className="field-group">
            <label>
              제조사 *<AutoTag on={has('manufacturer')} />
            </label>
            <select value={form.manufacturer} onChange={(e) => set({ manufacturer: e.target.value })}>
              <option value="">선택</option>
              {kitManufacturers.map((m) => (
                <option key={m.id} value={m.name}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field-group span-2">
            <label>
              품명 *<AutoTag on={has('name')} />
            </label>
            <input value={form.name} onChange={(e) => set({ name: e.target.value })} />
          </div>

          <div className="field-group">
            <label>
              품번<AutoTag on={has('kitNumber')} />
            </label>
            <input value={form.kitNumber} onChange={(e) => set({ kitNumber: e.target.value })} placeholder="예: 35165" />
          </div>

          <div className="field-group">
            <label>
              장르 *<AutoTag on={has('productType')} />
            </label>
            <select value={form.productType} onChange={(e) => setProductType(e.target.value)}>
              <option value="">선택</option>
              {PRODUCT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="field-group">
            <label>
              장르 상세<AutoTag on={has('genreDetail')} />
            </label>
            <input value={form.genreDetail} onChange={(e) => set({ genreDetail: e.target.value })} placeholder="예: 2차대전 중형전차" />
          </div>

          <div className="field-group">
            <label>
              운용국<AutoTag on={has('country')} />
            </label>
            <input list="country-suggestions" value={form.country} onChange={(e) => set({ country: e.target.value })} placeholder="선택 또는 직접 입력" />
            <datalist id="country-suggestions">
              {COUNTRY_SUGGESTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <div className="field-group">
            <label>
              스케일<AutoTag on={has('scale')} />
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                value={form.scaleCustom ? '__custom__' : form.scale}
                onChange={(e) => {
                  if (e.target.value === '__custom__') set({ scaleCustom: true, scale: '' });
                  else set({ scaleCustom: false, scale: e.target.value });
                }}
                style={{ flex: 1 }}
              >
                <option value="">선택</option>
                {SCALE_PRESETS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
                <option value="__custom__">직접 입력</option>
              </select>
              {form.scaleCustom && (
                <input style={{ flex: 1 }} value={form.scale} onChange={(e) => set({ scale: e.target.value })} placeholder="예: 1/72" />
              )}
            </div>
          </div>

          <div className="field-group">
            <label>크기 분류</label>
            <select value={form.sizeClass} onChange={(e) => set({ sizeClass: e.target.value })}>
              <option value="">선택</option>
              {SIZE_CLASSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="field-group span-2">
            <label>
              완성 크기 (mm)
              <AutoTag on={has('dim_length') || has('dim_width') || has('dim_height')} />
            </label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input value={form.dimensions.length} onChange={(e) => setDim('length', e.target.value)} placeholder="길이" inputMode="decimal" />
              <input value={form.dimensions.width} onChange={(e) => setDim('width', e.target.value)} placeholder="너비" inputMode="decimal" />
              <input value={form.dimensions.height} onChange={(e) => setDim('height', e.target.value)} placeholder="높이" inputMode="decimal" />
            </div>
            <button className="btn sm" onClick={autoFillDimensions} disabled={dimLoading}>
              {dimLoading ? '크기 조사 중...' : <><Ruler size={14} className="ico" aria-hidden="true" />크기 자동 입력</>}
            </button>
            <div className="text-faint mt-4">
              킷 상품정보의 완성 크기를 먼저 찾고, 없으면 실물 크기를 찾아 스케일로 나눠 계산합니다. 스케일을 먼저 입력하세요.
            </div>
            {dimInfo && (
              <div className="text-faint mt-4" style={{ fontSize: 12 }}>
                <div>{dimInfo.text} (검색 결과이니 확인해주세요)</div>
                {dimInfo.sources.length > 0 && (
                  <div>
                    출처:{' '}
                    {dimInfo.sources.map((src, i) => (
                      <a key={src.uri} href={src.uri} target="_blank" rel="noreferrer" style={{ marginRight: 6 }}>
                        [{i + 1}] {src.title}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </Section>

        <Section title="제작 계획" >
          <div className="field-group span-2">
            <label>구매일</label>
            <input value={form.purchaseDate} onChange={(e) => set({ purchaseDate: e.target.value })} placeholder="YYYY.MM.DD" />
          </div>
          {showsPriority(form.status) && (
            <div className="field-group">
              <label>우선 (다음에 만들 순서)</label>
              <input value={form.priority} onChange={(e) => set({ priority: e.target.value })} inputMode="numeric" />
            </div>
          )}
          <div className="field-group">
            <label>난이도</label>
            <input value={form.difficulty} onChange={(e) => set({ difficulty: e.target.value })} inputMode="numeric" />
          </div>

          <div className="field-group span-2">
            <label>선택Type (도색, 마킹)</label>
            <textarea rows={2} value={form.markingChoice} onChange={(e) => set({ markingChoice: e.target.value })} />
          </div>

          <div className="field-group">
            <label>
              피규어 선택<AutoTag on={has('figureChoice')} />
            </label>
            <input value={form.figureChoice} onChange={(e) => set({ figureChoice: e.target.value })} placeholder="예: 동봉, ali 전차병 4 set" />
          </div>

          <div className="field-group">
            <label>피규어 확보</label>
            <div className="segmented">
              {FIGURE_STATUSES.map((s) => (
                <button key={s} className={form.figureStatus === s ? 'active' : ''} onClick={() => set({ figureStatus: form.figureStatus === s ? '' : s })}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="field-group">
            <label>조립후 도색가능</label>
            <input value={form.paintAfterAssembly} onChange={(e) => set({ paintAfterAssembly: e.target.value })} placeholder="예: O (휠과 일부만도색)" />
          </div>

          <div className="field-group span-2">
            <label>현시점 기준 특이성</label>
            <input value={form.special} onChange={(e) => set({ special: e.target.value })} />
          </div>
        </Section>

        <Section title="보관 및 상태">
          <div className="field-group">
            <label>위치</label>
            <select value={form.buildLocation} onChange={(e) => set({ buildLocation: e.target.value })}>
              <option value="">선택</option>
              {BUILD_LOCATIONS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div className="field-group">
            <label>상태</label>
            <div className="segmented">
              {KIT_STATUSES.map((s) => (
                <button key={s} className={form.status === s ? 'active' : ''} onClick={() => set({ status: s })}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </Section>

        <div className="modal-actions">
          {!isNew && (
            <button className="btn danger" onClick={onDelete}>
              삭제
            </button>
          )}
          <button className="btn" onClick={onCancel}>
            취소
          </button>
          <button className="btn primary" onClick={onSave}>
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
