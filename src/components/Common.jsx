import { useState } from 'react';
import { brandColorVar, brandInitials } from '../lib/constants';
import { approximateColorFromName } from '../lib/colorWords';

export function BrandChip({ manufacturer, children }) {
  return (
    <span className="brand-chip">
      <span className="brand-dot" style={{ background: brandColorVar(manufacturer) }} />
      {children || manufacturer}
    </span>
  );
}

export function OwnedBadge({ owned }) {
  return owned ? (
    <span className="badge owned">● 보유</span>
  ) : (
    <span className="badge missing">○ 미보유</span>
  );
}

/** 제조사 아이콘. iconUrl이 있으면 등록된 이미지, 없으면 이니셜 뱃지(기본값) */
export function PaintCap({ manufacturer, size = 'sm', iconUrl }) {
  const cls = size === 'lg' ? 'paint-cap-lg' : 'paint-cap';
  if (iconUrl) {
    return <img src={iconUrl} alt={manufacturer} className={`${cls} brand-icon-img`} title={manufacturer} />;
  }
  return (
    <span className={`${cls} brand-icon`} style={{ background: brandColorVar(manufacturer) }} title={manufacturer}>
      {brandInitials(manufacturer)}
    </span>
  );
}

/** 도료 색상명 기반 근사 색상 스와치 (참고용 — 실제 도료 색과 다를 수 있음) */
export function ColorSwatch({ name, size = 'sm' }) {
  const hex = approximateColorFromName(name);
  const cls = size === 'lg' ? 'color-swatch-lg' : 'color-swatch';
  if (!hex) {
    return <span className={`${cls} color-swatch-empty`} title="색상 미리보기 없음 (참고용)" />;
  }
  return <span className={cls} style={{ background: hex }} title={`근사 색상 (참고용): ${hex}`} />;
}

export function Spinner() {
  return <div className="spinner" />;
}

/** 위시리스트에 담기/빼기 토글 버튼 (장바구니 방식) */
export function WishlistToggle({ paint, onToggle }) {
  const wishlisted = !!paint.wishlisted;
  return (
    <button
      className={`btn sm ${wishlisted ? 'primary' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onToggle(paint, !wishlisted);
      }}
      title={wishlisted ? '위시리스트에서 빼기' : '위시리스트에 담기'}
    >
      {wishlisted ? '🛒 담김' : '🛒 담기'}
    </button>
  );
}

/** 유사도료 아이콘 + 호버 툴팁. 모바일에선 탭하면 토글되도록 처리 */
export function SimilarTooltip({ similarPaints }) {
  const [tapped, setTapped] = useState(false);
  if (!similarPaints || similarPaints.length === 0) return null;

  return (
    <span
      className={`similar-tooltip ${tapped ? 'tapped' : ''}`}
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        setTapped((v) => !v);
      }}
    >
      <span className="tooltip-icon">≈ {similarPaints.length}</span>
      <span className="tooltip-panel">
        <div className="tooltip-title">유사도료</div>
        {similarPaints.map((s) => (
          <div className="tooltip-row" key={s.id}>
            <span>
              {s.manufacturer} {s.code} {s.name}
            </span>
            <span style={{ color: s.owned ? 'var(--owned)' : 'var(--missing)' }}>{s.owned ? '●' : '○'}</span>
          </div>
        ))}
      </span>
    </span>
  );
}
