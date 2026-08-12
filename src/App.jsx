import { useEffect, useMemo, useRef, useState } from 'react';
import { ensureAuth } from './firebase';
import { useCollection } from './lib/useCollection';
import { seedInitialData } from './lib/seedData';
import { paintsById } from './lib/matching';
import { Spinner } from './components/Common';

import AllPaints from './components/AllPaints';
import KitManager from './components/KitManager';
import Wishlist from './components/Wishlist';

const TABS = [
  { key: 'all', label: '도료', icon: '🗄️' },
  { key: 'wishlist', label: '위시리스트', icon: '🛒' },
  { key: 'kits', label: '킷', icon: '🏍️' },
];

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

  const byId = useMemo(() => paintsById(paints), [paints]);

  const loading = !authReady || kitsLoading || paintsLoading || linksLoading;
  const isEmpty = authReady && !loading && paints.length === 0;

  const seedLockRef = useRef(false);

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
        <div style={{ fontSize: 40 }}>🎨</div>
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
        <h1 className="font-display">
          <span className="paint-cap" style={{ background: 'var(--tamiya)' }} />
          프라 도료 관리
        </h1>
        <p className="subtitle">
          도료 {paints.length} (보유 {paints.filter((p) => p.owned).length}) · 킷 {kits.length}
        </p>
      </header>

      <main className="app-main">
        {tab === 'all' && <AllPaints paints={paints} byId={byId} />}
        {tab === 'wishlist' && <Wishlist paints={paints} kitPaintLinks={kitPaintLinks} kits={kits} byId={byId} />}
        {tab === 'kits' && (
          <KitManager kits={kits} kitPaintLinks={kitPaintLinks} paints={paints} byId={byId} />
        )}
      </main>

      <nav className="tab-bar">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab-btn ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            <span className="tab-icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </>
  );
}
