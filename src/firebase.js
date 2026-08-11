import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

// .env 파일 (프로젝트 루트)에 아래 값들을 채워주세요. .env.example 참고.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// 익명 인증: Firestore 보안 규칙에서 "로그인된 사용자만 read/write" 조건을 걸기 위한 최소 장치.
// 별도 로그인 UI 없이 앱 최초 접속 시 자동으로 익명 세션을 만듭니다.
export function ensureAuth() {
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      if (user) resolve(user);
      else {
        signInAnonymously(auth).then((cred) => resolve(cred.user)).catch(reject);
      }
    });
  });
}
