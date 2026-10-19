import { collection, doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { addItem, deleteItem } from './useCollection';

/** 도료 제조사 이름 변경 - 이 이름을 쓰는 모든 paints도 함께 변경 */
export async function renamePaintManufacturer(manufacturerDocId, oldName, newName, paints) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'paintManufacturers', manufacturerDocId), { name: newName });
  for (const p of paints.filter((p) => p.manufacturer === oldName)) {
    batch.update(doc(db, 'paints', p.id), { manufacturer: newName });
  }
  await batch.commit();
}

/** 킷 제조사 이름 변경 - 이 이름을 쓰는 모든 kits도 함께 변경 */
export async function renameKitManufacturer(manufacturerDocId, oldName, newName, kits) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'kitManufacturers', manufacturerDocId), { name: newName });
  for (const k of kits.filter((k) => k.manufacturer === oldName)) {
    batch.update(doc(db, 'kits', k.id), { manufacturer: newName });
  }
  await batch.commit();
}

export async function addManufacturer(collectionName, name) {
  return addItem(collectionName, { name });
}

export async function deleteManufacturer(collectionName, id) {
  return deleteItem(collectionName, id);
}

/**
 * 추천 목록 중 아직 없는 제조사만 일괄 추가 (이름 비교는 공백 제거·대소문자 무시).
 * 여러 번 실행해도 중복이 생기지 않음. 추가된 이름 배열을 반환.
 */
export async function addMissingManufacturers(collectionName, existingList, names) {
  const key = (n) => (n || '').trim().toLowerCase();
  const existing = new Set(existingList.map((m) => key(m.name)));
  const toAdd = [];
  for (const n of names) {
    if (!existing.has(key(n))) {
      existing.add(key(n));
      toAdd.push(n);
    }
  }
  if (toAdd.length === 0) return [];
  const batch = writeBatch(db);
  for (const name of toAdd) batch.set(doc(collection(db, collectionName)), { name });
  await batch.commit();
  return toAdd;
}
