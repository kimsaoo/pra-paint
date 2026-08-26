import { useState } from 'react';
import {
  PRODUCT_TYPES,
  PRODUCT_TYPE_COUNTRIES,
  SCALE_PRESETS,
  DEFAULT_SCALE_BY_TYPE,
  SIZE_CLASSES,
  BUILD_LOCATIONS,
  KIT_STATUSES,
} from '../lib/constants';
import { searchKitDimensions } from '../lib/gemini';

export const emptyKitForm = {
  name: '',
  manufacturer: '',
  productType: '',
  country: '',
  scale: '',
  scaleCustom: false,
  sizeClass: '',
  figureIncluded: true,
  figureNote: '',
  dimensions: { width: '', length: '', height: '' },
  buildLocation: '',
  status: '대기',
};

export function kitFormFromKit(kit) {
  return {
    name: kit.name || '',
    manufacturer: kit.manufacturer || '',
    productType: kit.productType || '',
    country: kit.country || '',
    scale: kit.scale || '',
    scaleCustom: !!kit.scale && !SCALE_PRESETS.includes(kit.scale),
    sizeClass: kit.sizeClass || '',
    figureIncluded: kit.figureIncluded !== false,
    figureNote: kit.figureNote || '',
    dimensions: kit.dimensions || { width: '', length: '', height: '' },
    buildLocation: kit.buildLocation || '',
    status: kit.status || '대기',
  };
}

export default function KitFormModal({ form, setForm, kitManufacturers, onCancel, onSave, onDelete, isNew }) {
  const [dimLoading, setDimLoading] = useState(false);
  const [dimNote, setDimNote] = useState('');

  function setProductType(pt) {
    setForm((f) => ({
      ...f,
      productType: pt,
      country: PRODUCT_TYPE_COUNTRIES[pt]?.includes(f.country) ? f.country : '',
      // 스케일을 아직 직접 고르지 않았다면(=커스텀 아님) 제품타입 기본 스케일로 맞춰줌
      scale: f.scaleCustom ? f.scale : DEFAULT_SCALE_BY_TYPE[pt] || f.scale,
    }));
  }

  function setDim(field, value) {
    setForm((f) => ({ ...f, dimensions: { ...f.dimensions, [field]: value } }));
  }

  async function autoFillDimensions() {
    if (!form.name.trim()) {
      alert('제품명을 먼저 입력해주세요.');
      return;
    }
    setDimLoading(true);
    setDimNote('');
    try {
      const result = await searchKitDimensions(form.manufacturer, form.name, form.scale);
      setForm((f) => ({
        ...f,
        dimensions: {
          width: result.width != null ? String(result.width) : f.dimensions.width,
          length: result.length != null ? String(result.length) : f.dimensions.length,
          height: result.height != null ? String(result.height) : f.dimensions.height,
        },
      }));
      const sourceLabel = result.source === 'kit' ? '킷 상품정보 기준' : '실물 크기를 스케일로 환산';
      setDimNote(`${sourceLabel}${result.note ? ` — ${result.note}` : ''} (검색 결과이니 확인해주세요)`);
    } catch (err) {
      console.error(err);
      alert(err.message || '크기 조사 중 오류가 발생했습니다.');
    } finally {
      setDimLoading(false);
    }
  }

  const countryOptions = PRODUCT_TYPE_COUNTRIES[form.productType] || [];

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{isNew ? '킷 추가' : '킷 수정'}</div>

        <div className="field-group">
          <label>제조사 *</label>
          <select value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}>
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
          <label>제품명 *</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>

        <div className="field-group">
          <label>운용국가</label>
          <select value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} disabled={!form.productType}>
            <option value="">{form.productType ? '선택' : '먼저 제품 타입을 선택하세요'}</option>
            {countryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="field-group">
          <label>스케일</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              value={form.scaleCustom ? '__custom__' : form.scale}
              onChange={(e) => {
                if (e.target.value === '__custom__') setForm({ ...form, scaleCustom: true, scale: '' });
                else setForm({ ...form, scaleCustom: false, scale: e.target.value });
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
              <input
                style={{ flex: 1 }}
                value={form.scale}
                onChange={(e) => setForm({ ...form, scale: e.target.value })}
                placeholder="예: 1/72"
              />
            )}
          </div>
        </div>

        <div className="field-group">
          <label>규모</label>
          <select value={form.sizeClass} onChange={(e) => setForm({ ...form, sizeClass: e.target.value })}>
            <option value="">선택</option>
            {SIZE_CLASSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="field-group">
          <label>피규어</label>
          <div className="segmented" style={{ marginBottom: 8 }}>
            <button
              className={form.figureIncluded ? 'active' : ''}
              onClick={() => setForm({ ...form, figureIncluded: true })}
            >
              포함
            </button>
            <button
              className={!form.figureIncluded ? 'active' : ''}
              onClick={() => setForm({ ...form, figureIncluded: false })}
            >
              불포함
            </button>
          </div>
          {!form.figureIncluded && (
            <input
              value={form.figureNote}
              onChange={(e) => setForm({ ...form, figureNote: e.target.value })}
              placeholder="어떤 피규어를 쓸지 (예: 타미야 별매 라이더 피규어)"
            />
          )}
        </div>

        <div className="field-group">
          <label>크기 (mm)</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              value={form.dimensions.width}
              onChange={(e) => setDim('width', e.target.value)}
              placeholder="Width"
              inputMode="decimal"
            />
            <input
              value={form.dimensions.length}
              onChange={(e) => setDim('length', e.target.value)}
              placeholder="Length"
              inputMode="decimal"
            />
            <input
              value={form.dimensions.height}
              onChange={(e) => setDim('height', e.target.value)}
              placeholder="Height"
              inputMode="decimal"
            />
          </div>
          <button className="btn sm" onClick={autoFillDimensions} disabled={dimLoading}>
            {dimLoading ? '조사 중...' : '🔍 자동 입력 (검색으로 추정)'}
          </button>
          {dimNote && <div className="text-faint mt-4">{dimNote}</div>}
        </div>

        <div className="field-group">
          <label>제작 위치</label>
          <select value={form.buildLocation} onChange={(e) => setForm({ ...form, buildLocation: e.target.value })}>
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
              <button key={s} className={form.status === s ? 'active' : ''} onClick={() => setForm({ ...form, status: s })}>
                {s}
              </button>
            ))}
          </div>
        </div>

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
