import { useEffect, useRef, useState } from 'react';
import { fileToResizedBase64 } from '../lib/imageUtils';
import { extractPaintsFromImage } from '../lib/gemini';
import { PAINT_TYPES } from '../lib/constants';
import { guessTamiyaPaintType, normalizeCodeForManufacturer } from '../lib/normalize';
import { addItem } from '../lib/useCollection';

function guessType(manufacturer, code) {
  if (manufacturer === 'Tamiya') return guessTamiyaPaintType(code);
  return '기타';
}

export default function ImagePaintImport({ paints, manufacturers = [], onCancel, onConfirm }) {
  const [status, setStatus] = useState('idle'); // idle | loading | review | error
  const [rows, setRows] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const dropRef = useRef(null);

  useEffect(() => {
    if (status === 'idle') dropRef.current?.focus();
  }, [status]);

  async function processFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      setErrorMsg('이미지 파일이 아닙니다.');
      setStatus('error');
      return;
    }
    setPreviewUrl(URL.createObjectURL(file));
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

  function handleFileInput(e) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  // Ctrl+V (또는 모바일 붙여넣기)로 이미지가 들어오면 처리
  function handlePasteEvent(e) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          processFile(file);
        }
        return;
      }
    }
  }

  // 버튼을 눌러서 명시적으로 클립보드 읽기 시도 (Async Clipboard API 지원 브라우저용)
  async function pasteFromClipboardButton() {
    try {
      if (!navigator.clipboard?.read) {
        alert('이 브라우저는 버튼으로 붙여넣기를 지원하지 않습니다. 이미지를 복사한 뒤 이 화면을 클릭하고 Ctrl+V(붙여넣기)를 눌러주세요.');
        return;
      }
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((t) => t.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const file = new File([blob], 'clipboard-image.png', { type: imageType });
          await processFile(file);
          return;
        }
      }
      alert('클립보드에서 이미지를 찾지 못했습니다. 먼저 이미지를 복사해주세요.');
    } catch (err) {
      console.error(err);
      alert('클립보드 접근이 거부됐습니다. 브라우저 권한을 확인하거나 Ctrl+V로 시도해주세요.');
    }
  }

  function updateRow(id, field, value) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  async function confirm() {
    const included = rows.filter((r) => r.include && r.code.trim());
    const result = [];
    for (const r of included) {
      const finalCode = normalizeCodeForManufacturer(r.manufacturer, r.code.trim());
      const existing = paints.find(
        (p) => p.manufacturer === r.manufacturer && p.code.trim().toUpperCase() === finalCode.toUpperCase()
      );
      if (existing) {
        result.push(existing);
      } else {
        const ref = await addItem('paints', {
          manufacturer: r.manufacturer,
          paintType: r.paintType || '기타',
          code: finalCode,
          name: r.name.trim(),
          note: '',
          owned: false,
          similarLinks: [],
        });
        result.push({ id: ref.id, manufacturer: r.manufacturer, code: finalCode, name: r.name.trim() });
      }
    }
    onConfirm(result);
  }

  return (
    <div
      className="card"
      ref={dropRef}
      tabIndex={0}
      onPaste={handlePasteEvent}
      style={{ outline: 'none' }}
    >
      {status === 'idle' && (
        <div>
          <p className="text-dim" style={{ marginBottom: 10 }}>
            설명서의 도료 지정표가 잘 보이는 이미지를 등록해주세요.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            <label className="btn sm" style={{ cursor: 'pointer' }}>
              📷 사진 촬영
              <input type="file" accept="image/*" capture="environment" onChange={handleFileInput} style={{ display: 'none' }} />
            </label>
            <label className="btn sm" style={{ cursor: 'pointer' }}>
              🖼️ 앨범에서 선택
              <input type="file" accept="image/*" onChange={handleFileInput} style={{ display: 'none' }} />
            </label>
            <button className="btn sm" onClick={pasteFromClipboardButton}>
              📋 클립보드에서 붙여넣기
            </button>
          </div>

          <div
            style={{
              border: '1px dashed var(--border)',
              borderRadius: 8,
              padding: '18px 12px',
              textAlign: 'center',
              color: 'var(--text-faint)',
              fontSize: 12,
            }}
          >
            여기를 클릭하고 <span className="code-text">Ctrl+V</span> (맥은 ⌘V)로도 붙여넣을 수 있습니다
          </div>
        </div>
      )}

      {status === 'loading' && (
        <div>
          {previewUrl && (
            <img src={previewUrl} alt="분석 중인 이미지" style={{ maxWidth: '100%', borderRadius: 8, marginBottom: 10 }} />
          )}
          <div className="text-dim">이미지 분석 중... (몇 초 정도 걸립니다)</div>
        </div>
      )}

      {status === 'error' && (
        <div>
          <div className="badge missing" style={{ marginBottom: 8 }}>
            인식 실패
          </div>
          <div className="text-dim" style={{ marginBottom: 10 }}>
            {errorMsg}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => { setStatus('idle'); setPreviewUrl(null); }}>
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
          {previewUrl && (
            <details style={{ marginBottom: 10 }}>
              <summary className="text-faint" style={{ cursor: 'pointer' }}>
                원본 이미지 보기
              </summary>
              <img src={previewUrl} alt="원본" style={{ maxWidth: '100%', borderRadius: 8, marginTop: 6 }} />
            </details>
          )}
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
