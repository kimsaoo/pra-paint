import { useEffect, useMemo, useRef, useState } from 'react';
import { ensureAuth } from './firebase';
import { useCollection } from './lib/useCollection';
import { seedInitialData } from './lib/seedData';
import { ensureManufacturerLists } from './lib/bootstrapManufacturers';
import { paintsById } from './lib/matching';
import { Spinner } from './components/Common';

import AllPaints from './components/AllPaints';
import KitManager from './components/KitManager';
import Wishlist from './components/Wishlist';
import ManufacturerManager from './components/ManufacturerManager';
import { Palette, ShoppingBag, Box, Factory, Database } from 'lucide-react';

const TABS = [
  { key: 'all', label: '도료', Icon: Palette },
  { key: 'wishlist', label: '위시리스트', Icon: ShoppingBag },
  { key: 'kits', label: '킷', Icon: Box },
  { key: 'manufacturers', label: '제조사', Icon: Factory },
];

/** 앱 마크: 도료병 실루엣 (자체 제작 도형) */
function BrandMark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="brand-mark">
      <rect x="9" y="3" width="14" height="7" rx="2" fill="var(--text)" />
      <rect x="6" y="11" width="20" height="18" rx="4" fill="var(--tamiya)" />
      <rect x="10" y="16" width="12" height="7" rx="1.5" fill="var(--surface)" opacity="0.9" />
    </svg>
  );
}

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [tab, setTab] = useState('all');

  useEffect(() => {
    ensureAuth()
      .then(() => setAuthReady(true))
      .catch((err) => console.error('인증 실패', err));
  }, []);

  const { data: kits, loading: kitsLoading } = useCollection('kits', authReady);
  const { data: paints, loading: paintsLoading } = useCollection('paints', authReady);
  const { data: kitPaintLinks, loading: linksLoading } = useCollection('kitPaintLinks', authReady);
  const { data: paintManufacturers, loading: pmLoading } = useCollection('paintManufacturers', authReady);
  const { data: kitManufacturers, loading: kmLoading } = useCollection('kitManufacturers', authReady);

  const byId = useMemo(() => paintsById(paints), [paints]);

  const ownedCount = paints.filter((p) => p.owned).length;
  const navCounts = {
    all: paints.length,
    wishlist: paints.filter((p) => p.wishlisted).length,
    kits: kits.length,
    manufacturers: paintManufacturers.length + kitManufacturers.length,
  };

  const loading = !authReady || kitsLoading || paintsLoading || linksLoading || pmLoading || kmLoading;
  const isEmpty = authReady && !loading && paints.length === 0;

  const seedLockRef = useRef(false);
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    if (!loading && !bootstrappedRef.current) {
      bootstrappedRef.current = true;
      ensureManufacturerLists(paints, kits).catch((err) => console.error('제조사 부트스트랩 실패', err));
    }
  }, [loading, paints, kits]);

  async function handleSeed() {
    if (seedLockRef.current) return; // 상태 업데이트를 기다리지 않고 즉시 막음 (더블클릭 방지)
    seedLockRef.current = true;
    setSeeding(true);
    try {
      await seedInitialData();
    } catch (err) {
      console.error(err);
      alert(err.message?.includes('이미') ? err.message : '초기 데이터를 불러오는 중 오류가 발생했습니다. 콘솔을 확인해주세요.');
    } finally {
      setSeeding(false);
      seedLockRef.current = false;
    }
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <Spinner />
        <div>불러오는 중...</div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="loading-screen" style={{ padding: 24, textAlign: 'center' }}>
        <Database size={40} className="ico" aria-hidden="true" />
        <div className="font-display" style={{ fontSize: 18 }}>
          빈 데이터베이스입니다
        </div>
        <p className="text-dim" style={{ maxWidth: 320 }}>
          기존 엑셀 데이터를 새 구조(도료 마스터 + 킷 + 연결)로 변환해서 불러올까요?
        </p>
        <button className="btn primary" onClick={handleSeed} disabled={seeding}>
          {seeding ? '불러오는 중...' : '초기 데이터 불러오기'}
        </button>
      </div>
    );
  }

  return (
    <>
      <header className="app-header">
        <BrandMark size={26} />
        <div>
          <h1>Next Build</h1>
          <p className="subtitle">
            도료 {paints.length} (보유 {ownedCount}), 킷 {kits.length}
          </p>
        </div>
      </header>

      <main className="app-main">
        {tab === 'all' && (
          <AllPaints paints={paints} byId={byId} manufacturers={paintManufacturers} kitPaintLinks={kitPaintLinks} />
        )}
        {tab === 'wishlist' && (
          <Wishlist paints={paints} kitPaintLinks={kitPaintLinks} kits={kits} byId={byId} manufacturers={paintManufacturers} />
        )}
        {tab === 'kits' && (
          <KitManager
            kits={kits}
            kitPaintLinks={kitPaintLinks}
            paints={paints}
            byId={byId}
            kitManufacturers={kitManufacturers}
            paintManufacturers={paintManufacturers}
          />
        )}
        {tab === 'manufacturers' && (
          <ManufacturerManager
            paintManufacturers={paintManufacturers}
            kitManufacturers={kitManufacturers}
            paints={paints}
            kits={kits}
          />
        )}
      </main>

      <nav className="tab-bar" aria-label="주 메뉴">
        <div className="nav-brand">
          <BrandMark size={30} />
          <div>
            <div className="nav-brand-name">Next Build</div>
            <div className="nav-brand-sub">What to build, what to buy</div>
          </div>
        </div>
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            className={`tab-btn ${tab === key ? 'active' : ''}`}
            aria-current={tab === key ? 'page' : undefined}
            onClick={() => setTab(key)}
          >
            <Icon size={20} strokeWidth={tab === key ? 2.2 : 1.8} className="tab-icon" aria-hidden="true" />
            <span className="tab-label">{label}</span>
            {navCounts[key] != null && <span className="nav-count">{navCounts[key]}</span>}
          </button>
        ))}
        <div className="nav-foot">
          보유 도료 {ownedCount} / 전체 {paints.length}
        </div>
      </nav>
    </>
  );
}
