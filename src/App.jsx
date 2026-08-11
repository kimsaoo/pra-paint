import { useEffect, useState } from 'react';
import { ensureAuth } from './firebase';
import { useCollection } from './lib/useCollection';
import { seedInitialData } from './lib/seedData';
import { Spinner } from './components/Common';

import MatchSearch from './components/MatchSearch';
import MasterList from './components/MasterList';
import KitManager from './components/KitManager';
import OwnedBrandManager from './components/OwnedBrandManager';
import Wishlist from './components/Wishlist';
import UnverifiedCodes from './components/UnverifiedCodes';

const TABS = [
  { key: 'search', label: '검색', icon: '🔍' },
  { key: 'master', label: '도료DB', icon: '🗄️' },
  { key: 'wishlist', label: '위시리스트', icon: '🛒' },
  { key: 'owned', label: '보유목록', icon: '🧴' },
  { key: 'kits', label: '킷', icon: '🏍️' },
  { key: 'unverified', label: '미검증', icon: '⚠️' },
];

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [tab, setTab] = useState('search');

  useEffect(() => {
    ensureAuth()
      .then(() => setAuthReady(true))
      .catch((err) => console.error('인증 실패', err));
  }, []);

  const { data: kits, loading: kitsLoading } = useCollection('kits', authReady);
  const { data: tamiyaMaster, loading: masterLoading } = useCollection('tamiyaMaster', authReady);
  const { data: ownedOtherBrand, loading: otherLoading } = useCollection('ownedOtherBrand', authReady);
  const { data: ownedAcrylic, loading: acrylicLoading } = useCollection('ownedAcrylic', authReady);

  const loading = !authReady || kitsLoading || masterLoading || otherLoading || acrylicLoading;
  const isEmpty = authReady && !loading && tamiyaMaster.length === 0;

  async function handleSeed() {
    setSeeding(true);
    try {
      await seedInitialData();
    } catch (err) {
      console.error(err);
      alert('초기 데이터를 불러오는 중 오류가 발생했습니다. 콘솔을 확인해주세요.');
    } finally {
      setSeeding(false);
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
          프라목록관리.xlsx에서 추출한 초기 데이터(도료 64종, 보유목록, 킷 5종)를 불러올까요?
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
          도료 {tamiyaMaster.length} · 킷 {kits.length} · 보유목록{' '}
          {ownedOtherBrand.length + ownedAcrylic.length}
        </p>
      </header>

      <main className="app-main">
        {tab === 'search' && (
          <MatchSearch
            tamiyaMaster={tamiyaMaster}
            ownedOtherBrand={ownedOtherBrand}
            ownedAcrylic={ownedAcrylic}
            kits={kits}
          />
        )}
        {tab === 'master' && (
          <MasterList
            tamiyaMaster={tamiyaMaster}
            ownedOtherBrand={ownedOtherBrand}
            ownedAcrylic={ownedAcrylic}
            kits={kits}
          />
        )}
        {tab === 'wishlist' && (
          <Wishlist
            tamiyaMaster={tamiyaMaster}
            ownedOtherBrand={ownedOtherBrand}
            ownedAcrylic={ownedAcrylic}
            kits={kits}
          />
        )}
        {tab === 'owned' && (
          <OwnedBrandManager ownedAcrylic={ownedAcrylic} ownedOtherBrand={ownedOtherBrand} />
        )}
        {tab === 'kits' && <KitManager kits={kits} tamiyaMaster={tamiyaMaster} />}
        {tab === 'unverified' && <UnverifiedCodes tamiyaMaster={tamiyaMaster} />}
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
