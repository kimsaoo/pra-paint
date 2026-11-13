// 프라목록관리.xlsx(제작계획, 제작완료) 변환 JSON을 Firestore kits 컬렉션에 이관하는 1회성 스크립트.
//
// 사용법 (paint-app 폴더에서):
//   node scripts/importKits.mjs --file kits_import_20261113_01.json --offline   ← JSON 검증만 (DB 접속 안 함)
//   node scripts/importKits.mjs --file kits_import_20261113_01.json             ← 미리보기 (DB 읽기만)
//   node scripts/importKits.mjs --file kits_import_20261113_01.json --apply     ← 실제 기록
//
// 동작 원칙
// - 같은 importKey(시트명:행번호)가 이미 있으면 건너뜀 → 여러 번 실행해도 중복 생성 안 됨
// - mergeWithExistingName이 있는 행은 같은 이름의 기존 킷에 병합(도료 연결 유지). 시트가 빈 칸이면 기존 값 유지
//   병합 시 품명은 앱에 등록된 기존 이름을 유지 (시트 품명은 sheetRaw에 보존)
// - 병합되지 않은 기존 킷은 시트 행과 이름 유사도를 비교해 중복 의심을 출력
// - 기존 킷 상태값 변환: 대기 → 제작계획, 완료 → 제작완료
// - 시트에서 쓰는 킷 제조사 중 목록에 없는 이름은 추가 (대소문자 무시 비교)
// - .env의 Firebase 설정과 익명 로그인을 사용. 설정 값은 화면에 출력하지 않음

import fs from 'node:fs';
import path from 'node:path';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, writeBatch } from 'firebase/firestore';

const args = process.argv.slice(2);
const argValue = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const APPLY = args.includes('--apply');
const OFFLINE = args.includes('--offline');
const FILE = argValue('--file');

function fail(msg) {
  console.error(`\n[중단] ${msg}\n`);
  process.exit(1);
}

if (!FILE) fail('--file 로 변환 JSON 경로를 지정하세요. 예: --file kits_import_20261113_01.json');
if (!fs.existsSync(FILE)) fail(`파일이 없습니다: ${FILE}`);

const data = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
const rows = data.kits || [];
const LEGACY_STATUS = { 대기: '제작계획', 완료: '제작완료' };

// ---------- 1. JSON 검증 ----------
const keys = new Set();
const problems = [];
for (const r of rows) {
  if (!r.importKey || !r.name || !r.status) problems.push(`필수값 누락: ${r.importKey || r.name}`);
  if (keys.has(r.importKey)) problems.push(`importKey 중복: ${r.importKey}`);
  keys.add(r.importKey);
}
const byStatus = rows.reduce((m, r) => ((m[r.status] = (m[r.status] || 0) + 1), m), {});
console.log(`\n변환 파일: ${path.basename(FILE)}  (${data.source || ''})`);
console.log(`킷 ${rows.length}건  ${Object.entries(byStatus).map(([k, v]) => `${k} ${v}`).join(', ')}`);
console.log(`확인 필요 표시 ${rows.filter((r) => r.checkNeeded?.length).length}건, 기존 킷 병합 대상 ${rows.filter((r) => r.mergeWithExistingName).length}건`);
if (problems.length) fail(`JSON 오류 ${problems.length}건\n - ${problems.join('\n - ')}`);
if (OFFLINE) {
  console.log('\n[--offline] JSON 검증만 수행했습니다. DB에는 접속하지 않았습니다.\n');
  process.exit(0);
}

// ---------- 2. Firebase 접속 ----------
function loadEnv(file = '.env') {
  if (!fs.existsSync(file)) fail('.env 파일이 없습니다. paint-app 폴더(저장소 루트)에서 실행하세요.');
  const env = {};
  for (const line of fs.readFileSync(file, 'utf-8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return env;
}
const env = loadEnv();
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};
const missing = Object.entries(firebaseConfig).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) fail(`.env에 값이 없는 항목: ${missing.join(', ')} (값은 출력하지 않음)`);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
try {
  await signInAnonymously(getAuth(app));
} catch (err) {
  fail(`익명 로그인 실패: ${err.code || err.message}\nAPI 키에 웹사이트(리퍼러) 제한이 걸려 있으면 Node에서 로그인이 막힐 수 있습니다.`);
}

const kitSnap = await getDocs(collection(db, 'kits'));
const existingKits = kitSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
const manSnap = await getDocs(collection(db, 'kitManufacturers'));
const existingMans = new Set(manSnap.docs.map((d) => (d.data().name || '').trim().toLowerCase()));

// ---------- 3. 계획 수립 ----------
const isEmpty = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
function toDoc(r) {
  const { mergeWithExistingName, checkNeeded, ...rest } = r;
  return { ...rest, importCheck: checkNeeded || [], importedAt: new Date().toISOString() };
}
function mergeDoc(existing, r) {
  const incoming = toDoc(r);
  const out = {};
  for (const [k, v] of Object.entries(incoming)) {
    if (k === 'name') continue; // 기존 이름 유지
    if (k === 'dimensions') {
      const dims = { ...(existing.dimensions || {}) };
      for (const [dk, dv] of Object.entries(v || {})) if (!isEmpty(dv)) dims[dk] = dv;
      out.dimensions = dims;
    } else if (!isEmpty(v)) out[k] = v;
  }
  return out;
}

const importedKeys = new Set(existingKits.map((k) => k.importKey).filter(Boolean));
const plan = { create: [], merge: [], skip: [], statusFix: [], mans: [] };
let nextOrder = existingKits.reduce((m, k) => Math.max(m, k.order ?? 0), -1) + 1;
const mergedIds = new Set();

for (const r of rows) {
  if (importedKeys.has(r.importKey)) {
    plan.skip.push(r);
    continue;
  }
  if (r.mergeWithExistingName) {
    const target = existingKits.find((k) => !k.importKey && !mergedIds.has(k.id) && k.name === r.mergeWithExistingName);
    if (target) {
      mergedIds.add(target.id);
      plan.merge.push({ r, target, data: mergeDoc(target, r) });
      continue;
    }
    console.log(`  - 병합 대상 "${r.mergeWithExistingName}"을 찾지 못해 새 킷으로 만듭니다: ${r.name}`);
  }
  plan.create.push({ r, data: { ...toDoc(r), order: nextOrder++ } });
}
for (const k of existingKits) {
  if (mergedIds.has(k.id)) continue;
  if (LEGACY_STATUS[k.status]) plan.statusFix.push({ k, to: LEGACY_STATUS[k.status] });
}
// 병합되지 않은 기존 킷 중 시트 행과 이름이 비슷한 것 → 중복 의심
const norm = (n) =>
  String(n || '')
    .toLowerCase()
    .replace(/1\s*[/:]\s*\d+/g, ' ')
    .replace(/[^0-9a-z가-힣]+/g, ' ')
    .split(' ')
    .filter((t) => t.length > 1);
function similarity(a, b) {
  const A = new Set(norm(a));
  const B = new Set(norm(b));
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const t of A) if (B.has(t)) hit++;
  return hit / Math.min(A.size, B.size);
}
const unmatched = existingKits.filter((k) => !k.importKey && !mergedIds.has(k.id));
const suspects = [];
for (const k of unmatched) {
  let best = null;
  for (const { r } of plan.create) {
    const sc = similarity(k.name, r.name);
    if (sc >= 0.5 && (!best || sc > best.sc)) best = { r, sc };
  }
  if (best) suspects.push({ k, ...best });
}

for (const name of data.kitManufacturers || []) {
  if (!existingMans.has(name.trim().toLowerCase())) plan.mans.push(name);
}

console.log('\n===== 실행 계획 =====');
console.log(`신규 킷 생성      ${plan.create.length}건`);
console.log(`기존 킷 병합      ${plan.merge.length}건`);
plan.merge.forEach(({ r, target }) => console.log(`   "${target.name}"  ←  ${r.sheet} ${r.sheetRow}행 "${r.name}"`));
console.log(`이미 이관됨(건너뜀) ${plan.skip.length}건`);
console.log(`기존 킷 상태 변환  ${plan.statusFix.length}건`);
plan.statusFix.forEach(({ k, to }) => console.log(`   "${k.name}"  ${k.status} → ${to}`));
console.log(`킷 제조사 추가     ${plan.mans.length}건${plan.mans.length ? `: ${plan.mans.join(', ')}` : ''}`);
console.log(`\n병합되지 않은 기존 킷 ${unmatched.length}건 (이관 후에도 그대로 남음)`);
unmatched.forEach((k) => console.log(`   "${k.name}"  [${k.status || '상태 없음'}]`));
if (suspects.length) {
  console.log(`\n⚠ 중복 의심 ${suspects.length}건: 아래 기존 킷과 비슷한 시트 행이 '신규 생성'으로 잡혀 있습니다.`);
  suspects.forEach(({ k, r }) => console.log(`   기존 "${k.name}"  ↔  ${r.sheet} ${r.sheetRow}행 "${r.name}"`));
}

if (APPLY && suspects.length && !args.includes('--allow-suspects')) {
  fail('중복 의심이 있어 기록하지 않았습니다. 결과를 공유해 주시고, 중복이 아니면 --allow-suspects 를 함께 붙여 실행하세요.');
}
if (!APPLY) {
  console.log('\n[미리보기] DB에는 아무것도 기록하지 않았습니다. 실제 기록은 --apply 를 붙여 다시 실행하세요.\n');
  process.exit(0);
}

// ---------- 4. 기록 (배치당 400건) ----------
const ops = [];
for (const name of plan.mans) ops.push((b) => b.set(doc(collection(db, 'kitManufacturers')), { name }));
for (const { data: d } of plan.create) ops.push((b) => b.set(doc(collection(db, 'kits')), d));
for (const { target, data: d } of plan.merge) ops.push((b) => b.update(doc(db, 'kits', target.id), d));
for (const { k, to } of plan.statusFix) ops.push((b) => b.update(doc(db, 'kits', k.id), { status: to }));

for (let i = 0; i < ops.length; i += 400) {
  const batch = writeBatch(db);
  ops.slice(i, i + 400).forEach((op) => op(batch));
  await batch.commit();
  console.log(`  기록 ${Math.min(i + 400, ops.length)}/${ops.length}`);
}
console.log('\n[완료] 이관을 마쳤습니다. 앱에서 킷 탭을 확인하세요.\n');
process.exit(0);
