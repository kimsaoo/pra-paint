import { useState } from 'react';
import { fileToResizedBase64 } from '../lib/imageUtils';
import { extractPaintsFromImage } from '../lib/gemini';
import { PAINT_TYPES } from '../lib/constants';
import { guessTamiyaPaintType } from '../lib/normalize';
import { addItem } from '../lib/useCollection';

function guessType(manufacturer, code) {
  if (manufacturer === 'Tamiya') return guessTamiyaPaintType(code);
  return '기타';
}

export default function ImagePaintImport({ paints, manufacturers = [], onCancel, onConfirm }) {
  const [status, setStatus] = useState('idle'); // idle | loading | review | error
  const [rows, setRows] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus('loading');
    try {
      const base64 = await fileToResizedBase64(file);
      const extracted = await extractPaintsFromImage(base64);
      if (extracted.length === 0) {
        setErrorMsg('이미지에서 도료 항목을 찾지 못했습니다. 표가 잘 보이는 사진으로 다시 시도해주세요.');
        setStatus('error');
        return;
      }
      setRows(
        extracted.map((item, idx) => ({
          id: idx,
          include: true,
          manufacturer: item.manufacturer || 'Tamiya',
          paintType: guessType(item.manufacturer || 'Tamiya', item.code || ''),
          code: item.code || '',
          name: item.name || '',
        }))
      );
      setStatus('review');
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || '인식 중 오류가 발생했습니다.');
      setStatus('error');
    }
  }

  function updateRow(id, field, value) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  async function confirm() {
    const included = rows.filter((r) => r.include && r.code.trim());
    const result = [];
    for (const r of included) {
      const existing = paints.find(
        (p) => p.manufacturer === r.manufacturer && p.code.trim().toUpperCase() === r.code.trim().toUpperCase()
      );
      if (existing) {
        result.push(existing);
      } else {
        const ref = await addItem('paints', {
          manufacturer: r.manufacturer,
          paintType: r.paintType || '기타',
          code: r.code.trim(),
          name: r.name.trim(),
          note: '',
          owned: false,
          similarLinks: [],
        });
        result.push({ id: ref.id, manufacturer: r.manufacturer, code: r.code.trim(), name: r.name.trim() });
      }
    }
    onConfirm(result);
  }

  return (
    <div className="card">
      {status === 'idle' && (
        <div>
          <p className="text-dim" style={{ marginBottom: 10 }}>
            설명서의 도료 지정표가 잘 보이게 사진을 찍거나 선택해주세요.
          </p>
          <input type="file" accept="image/*" capture="environment" onChange={handleFile} />
        </div>
      )}

      {status === 'loading' && <div className="text-dim">이미지 분석 중... (몇 초 정도 걸립니다)</div>}

      {status === 'error' && (
        <div>
          <div className="badge missing" style={{ marginBottom: 8 }}>
            인식 실패
          </div>
          <div className="text-dim" style={{ marginBottom: 10 }}>
            {errorMsg}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => setStatus('idle')}>
              다시 시도
            </button>
            <button className="btn" onClick={onCancel}>
              취소
            </button>
          </div>
        </div>
      )}

      {status === 'review' && (
        <div>
          <p className="text-dim" style={{ marginBottom: 10 }}>
            인식된 {rows.length}개 항목입니다. 틀린 부분은 고치고, 필요 없는 항목은 체크 해제하세요.
          </p>
          {rows.map((r) => (
            <div
              key={r.id}
              className="mt-8"
              style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <input type="checkbox" checked={r.include} onChange={(e) => updateRow(r.id, 'include', e.target.checked)} />
                <select value={r.manufacturer} onChange={(e) => updateRow(r.id, 'manufacturer', e.target.value)} style={{ flex: 1 }}>
                  {manufacturers.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <select value={r.paintType} onChange={(e) => updateRow(r.id, 'paintType', e.target.value)} style={{ flex: 1 }}>
                  {PAINT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={r.code}
                  onChange={(e) => updateRow(r.id, 'code', e.target.value)}
                  placeholder="코드"
                  style={{ flex: 1 }}
                />
                <input
                  value={r.name}
                  onChange={(e) => updateRow(r.id, 'name', e.target.value)}
                  placeholder="이름"
                  style={{ flex: 2 }}
                />
              </div>
            </div>
          ))}

          <div className="modal-actions">
            <button className="btn" onClick={onCancel}>
              취소
            </button>
            <button className="btn primary" onClick={confirm}>
              선택한 {rows.filter((r) => r.include).length}개 등록
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
