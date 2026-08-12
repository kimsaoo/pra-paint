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
