import { addDoc, collection, writeBatch, doc } from 'firebase/firestore';
import { db } from '../firebase';
import tamiyaMasterRaw from '../data/tamiya_master.json';
import ownedOtherBrandRaw from '../data/owned_other_brand.json';
import ownedAcrylicRaw from '../data/owned_acrylic.json';
import { DEFAULT_KITS, UNVERIFIED_KEYWORDS } from './constants';

// 문서 5번 섹션의 "미확인 브랜드/색상군" 키워드 매칭 방식.
// (색상 단어 자동 비교 방식도 시도해봤지만 Silver/Aluminum, Grey 계열처럼
//  이미 확인 완료된 항목까지 오탐지가 많아 문서 명시 키워드 방식으로 복귀함)
function isUnverified(similarText, brand) {
  if (!similarText) return false;
  const keywords = UNVERIFIED_KEYWORDS[brand];
  if (!keywords) return false;
  const lower = similarText.toLowerCase();
  return keywords.some((k) => lower.includes(k));
}

// 개별적으로 확인된 데이터 오류 보정 (2026-08 세션에서 발견)
// LP-41(Mica blue)의 MIG 유사색으로 잘못 적혀있던 "MIG-0048"은 실제로는 Yellow 도료라
// 유사색 후보에서 제외함. 아직 올바른 대체 코드가 없으므로 미검증으로 표시해 재검토를 유도.
const MANUAL_OVERRIDES = {
  'LP-41': { migVerified: false },
};

/**
 * 빈 데이터베이스에 엑셀에서 추출한 초기 데이터를 채워넣습니다.
 * 이미 데이터가 있으면 호출하지 않도록 UI에서 막아주세요 (중복 방지).
 */
export async function seedInitialData() {
  const batch = writeBatch(db);

  // 1) 키트 목록
  const kitIdByName = {};
  DEFAULT_KITS.forEach((name, idx) => {
    const ref = doc(collection(db, 'kits'));
    kitIdByName[name] = ref.id;
    batch.set(ref, { name, order: idx });
  });

  // 2) 아크릴 제외 보유목록 (시트B)
  for (const [brand, items] of Object.entries(ownedOtherBrandRaw)) {
    for (const text of items) {
      const ref = doc(collection(db, 'ownedOtherBrand'));
      batch.set(ref, { brand, text });
    }
  }

  // 3) 아크릴 보유목록 (시트C)
  for (const [brand, items] of Object.entries(ownedAcrylicRaw)) {
    for (const text of items) {
      const ref = doc(collection(db, 'ownedAcrylic'));
      batch.set(ref, { brand, text });
    }
  }

  // 4) 타미야 마스터 (시트A)
  for (const item of tamiyaMasterRaw) {
    const ref = doc(collection(db, 'tamiyaMaster'));
    batch.set(ref, {
      code: item.code_raw,
      colorName: item.color_name,
      kitsNeeded: (item.kits_needed || []).map((n) => kitIdByName[n]).filter(Boolean),
      vallejoSimilar: item.vallejo_similar || '',
      migSimilar: item.mig_similar || '',
      akSimilar: item.ak_similar || '',
      vallejoVerified: true,
      migVerified: MANUAL_OVERRIDES[item.code_raw]?.migVerified ?? !isUnverified(item.mig_similar, 'mig'),
      akVerified: MANUAL_OVERRIDES[item.code_raw]?.akVerified ?? !isUnverified(item.ak_similar, 'ak'),
    });
  }

  await batch.commit();
}
