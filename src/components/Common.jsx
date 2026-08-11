import { brandLabel, brandVar } from '../lib/constants';

export function BrandChip({ brand, children }) {
  return (
    <span className="brand-chip">
      <span className="brand-dot" style={{ background: `var(${brandVar(brand)})` }} />
      {children || brandLabel(brand)}
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

export function PaintCap({ brand, size = 'sm' }) {
  const cls = size === 'lg' ? 'paint-cap-lg' : 'paint-cap';
  return <span className={cls} style={{ background: `var(${brandVar(brand)})` }} />;
}

export function Spinner() {
  return <div className="spinner" />;
}
