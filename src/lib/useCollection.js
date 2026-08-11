import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Firestore 컬렉션을 실시간 구독하는 훅.
 * ready: 인증(ensureAuth) 완료 후에만 true로 넘겨서 구독을 시작하게 함.
 */
export function useCollection(name, ready) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    const unsub = onSnapshot(
      collection(db, name),
      (snap) => {
        setData(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error(`[${name}] onSnapshot error`, err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [name, ready]);

  return { data, loading };
}

export async function addItem(collectionName, data) {
  return addDoc(collection(db, collectionName), data);
}

export async function updateItem(collectionName, id, data) {
  return updateDoc(doc(db, collectionName, id), data);
}

export async function deleteItem(collectionName, id) {
  return deleteDoc(doc(db, collectionName, id));
}
