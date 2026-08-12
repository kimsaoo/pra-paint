import { collection, doc, getDocs, limit, query, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { FALLBACK_PAINT_MANUFACTURERS, FALLBACK_KIT_MANUFACTURERS } from './constants';

/**
 * paintManufacturers/kitManufacturers 컬렉션이 비어있으면(=아직 한 번도 안 만들어졌으면),
 * 기존 paints/kits에 실제로 쓰인 제조사 값들을 스캔해서 채워넣습니다.
 * (하드코딩된 목록이 아니라 실제 데이터 기준으로 만들어야, 오타난 제조사도 목록에 나타나서
 *  나중에 "제조사 관리" 화면에서 이름을 고치면 실제 도료들에도 반영됨)
 */
export async function ensureManufacturerLists(paints, kits) {
  const paintSnap = await getDocs(query(collection(db, 'paintManufacturers'), limit(1)));
  if (paintSnap.empty) {
    const found = new Set(paints.map((p) => p.manufacturer).filter(Boolean));
    FALLBACK_PAINT_MANUFACTURERS.forEach((m) => found.add(m));
    const batch = writeBatch(db);
    for (const name of found) batch.set(doc(collection(db, 'paintManufacturers')), { name });
    await batch.commit();
  }

  const kitSnap = await getDocs(query(collection(db, 'kitManufacturers'), limit(1)));
  if (kitSnap.empty) {
    const found = new Set(kits.map((k) => k.manufacturer).filter(Boolean));
    FALLBACK_KIT_MANUFACTURERS.forEach((m) => found.add(m));
    const batch = writeBatch(db);
    for (const name of found) batch.set(doc(collection(db, 'kitManufacturers')), { name });
    await batch.commit();
  }
}
