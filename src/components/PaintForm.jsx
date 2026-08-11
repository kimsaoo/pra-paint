import { PAINT_MANUFACTURERS, PAINT_TYPES } from '../lib/constants';

export default function PaintFormFields({ value, onChange, disabled }) {
  return (
    <>
      <div className="field-group">
        <label>제조사 *</label>
        <select
          value={value.manufacturer}
          onChange={(e) => onChange({ ...value, manufacturer: e.target.value })}
          disabled={disabled}
        >
          <option value="">선택</option>
          {PAINT_MANUFACTURERS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div className="field-group">
        <label>도료 타입 *</label>
        <select
          value={value.paintType}
          onChange={(e) => onChange({ ...value, paintType: e.target.value })}
          disabled={disabled}
        >
          <option value="">선택</option>
          {PAINT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div className="field-group">
        <label>도료 코드 *</label>
        <input
          value={value.code}
          onChange={(e) => onChange({ ...value, code: e.target.value })}
          placeholder="예: 70.951"
          disabled={disabled}
        />
      </div>
      <div className="field-group">
        <label>도료명 *</label>
        <input
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          placeholder="예: White"
          disabled={disabled}
        />
      </div>
      <div className="field-group">
        <label>비고 (옵션)</label>
        <input
          value={value.note}
          onChange={(e) => onChange({ ...value, note: e.target.value })}
          placeholder="예: 유광"
          disabled={disabled}
        />
      </div>
    </>
  );
}

export const emptyPaintForm = { manufacturer: '', paintType: '', code: '', name: '', note: '' };

export function isPaintFormValid(form) {
  return !!(form.manufacturer && form.paintType && form.code.trim() && form.name.trim());
}
