import { writeBatch, doc, collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../firebase';
import tamiyaMasterRaw from '../data/tamiya_master.json';
import ownedOtherBrandRaw from '../data/owned_other_brand.json';
import ownedAcrylicRaw from '../data/owned_acrylic.json';
import { DEFAULT_KITS, UNVERIFIED_KEYWORDS } from './constants';
import {
  parseVallejo,
  parseMig,
  parseAk,
  splitCodeNameNote,
  parseTestorItaleri,
  normalizeTamiyaCode,
  guessTamiyaPaintType,
  codeEquals,
} from './normalize';

// LP-41(Mica blue)의 MIG 유사색으로 잘못 적혀있던 "MIG-0048"은 실제로 Yellow 도료라 제외함.
// (2026-08 세션에서 발견 — 아직 올바른 대체 코드가 없어 마이그레이션에서도 계속 비워둠)
const MANUAL_OVERRIDES = { 'LP-41': { migSimilar: null } };

function isUnverified(similarText, brand) {
  if (!similarText) return false;
  const keywords = UNVERIFIED_KEYWORDS[brand];
  if (!keywords) return false;
  const lower = similarText.toLowerCase();
  return keywords.some((k) => lower.includes(k));
}

/**
 * paints 맵: key "제조사::코드" -> { manufacturer, paintType, code, name, note, owned, similarLinks: [{targetKey, verified}] }
 * Firestore 문서 ID는 마지막에 한 번에 발급하고 매핑해서 씁니다.
 */
function buildPaintGraph() {
  const paints = new Map();

  function keyOf(manufacturer, code) {
    return `${manufacturer}::${String(code).trim()}`;
  }

  function getOrCreate(manufacturer, code, name, paintType, owned = false, note = '') {
    if (!code) return null;
    const key = keyOf(manufacturer, code);
    if (paints.has(key)) {
      const existing = paints.get(key);
      if (owned) existing.owned = true;
      return key;
    }
    paints.set(key, {
      manufacturer,
      code: String(code).trim(),
      name: name || '',
      paintType,
      owned,
      note: note || '',
      similarLinks: [],
    });
    return key;
  }

  function addSimilarLink(keyA, keyB, verified) {
    if (!keyA || !keyB || keyA === keyB) return;
    const a = paints.get(keyA);
    const b = paints.get(keyB);
    if (!a.similarLinks.some((l) => l.targetKey === keyB)) a.similarLinks.push({ targetKey: keyB, verified });
    if (!b.similarLinks.some((l) => l.targetKey === keyA)) b.similarLinks.push({ targetKey: keyA, verified });
  }

  const guessAcrylicType = (name) => (/spray|스프레이/i.test(name || '') ? '아크릴스프레이' : '아크릴');

  // 1) 아크릴 보유목록 (Vallejo/MIG/AK)
  for (const text of ownedAcrylicRaw.vallejo || []) {
    const { code, name } = parseVallejo(text);
    getOrCreate('Vallejo', code, name, guessAcrylicType(name), true);
  }
  for (const text of ownedAcrylicRaw.mig || []) {
    const { code, name } = parseMig(text);
    getOrCreate('MIG', code, name, guessAcrylicType(name), true);
  }
  for (const text of ownedAcrylicRaw.ak || []) {
    let { code, name } = parseAk(text);
    if (!code) ({ code, name } = splitCodeNameNote(text));
    getOrCreate('AK', code, name, guessAcrylicType(name), true);
  }

  // 2) 기타 브랜드 보유목록
  for (const text of ownedOtherBrandRaw.tamiya_enamel_lacquer || []) {
    const { code, name, note } = splitCodeNameNote(text);
    getOrCreate('Tamiya', code, name, '에나멜', true, note);
  }
  for (const text of ownedOtherBrandRaw.tamiya_ts_lp || []) {
    const { code, name, note } = splitCodeNameNote(text);
    const ptype = /^LP-/i.test(code) ? '락커(병)' : /^TS-/i.test(code) ? '락커스프레이' : '기타';
    getOrCreate('Tamiya', code, name, ptype, true, note);
  }
  for (const text of ownedOtherBrandRaw.academy_enamel || []) {
    const { code, name, note } = splitCodeNameNote(text);
    getOrCreate('Academy', code, name, '에나멜', true, note);
  }
  for (const text of ownedOtherBrandRaw.gunze_hobby_color || []) {
    const { code, name, note } = splitCodeNameNote(text);
    const ptype = /spray|스프레이/i.test(name) ? '락커스프레이' : '아크릴';
    getOrCreate('GSI', code, name, ptype, true, note);
  }
  for (const text of ownedOtherBrandRaw.gunze_lacquer_s || []) {
    const { code, name, note } = splitCodeNameNote(text);
    getOrCreate('GSI', code, name, '락커스프레이', true, note);
  }
  for (const text of ownedOtherBrandRaw.other_testor_italeri || []) {
    const { manufacturer, code, name, note } = parseTestorItaleri(text);
    getOrCreate(manufacturer, code, name, '에나멜', true, note);
  }

  // 3) 타미야 마스터 64종 자체를 paints에 등록 (이미 있으면 재사용, 없으면 미보유로 신규 생성)
  function findExistingTamiyaKey(code1, code2) {
    for (const [key, v] of paints.entries()) {
      if (v.manufacturer !== 'Tamiya') continue;
      if (codeEquals(v.code, code1) || (code2 && codeEquals(v.code, code2))) return key;
    }
    return null;
  }

  const tamiyaKeyByMasterCode = {};
  for (const item of tamiyaMasterRaw) {
    const { code1, code2 } = normalizeTamiyaCode(item.code_raw);
    let key = findExistingTamiyaKey(code1, code2);
    if (!key) key = getOrCreate('Tamiya', code1, item.color_name, guessTamiyaPaintType(code1), false);
    tamiyaKeyByMasterCode[item.code_raw] = key;
  }

  // 4) 유사색(Vallejo/MIG/AK) → placeholder 생성 + 양방향 유사도료 링크
  const parserByBrand = { Vallejo: parseVallejo, MIG: parseMig, AK: parseAk };
  const fieldByBrand = { Vallejo: 'vallejo_similar', MIG: 'mig_similar', AK: 'ak_similar' };

  for (const item of tamiyaMasterRaw) {
    const tamiyaKey = tamiyaKeyByMasterCode[item.code_raw];
    const overrides = MANUAL_OVERRIDES[item.code_raw] || {};

    for (const brand of ['Vallejo', 'MIG', 'AK']) {
      const overrideField = `${brand.toLowerCase()}Similar`;
      const text = overrideField in overrides ? overrides[overrideField] : item[fieldByBrand[brand]];
      if (!text) continue;
      const { code, name } = parserByBrand[brand](text);
      if (!code) continue;
      const similarKey = getOrCreate(brand, code, name, '아크릴', false);
      const verified = !isUnverified(text, brand === 'Vallejo' ? 'vallejo' : brand);
      addSimilarLink(tamiyaKey, similarKey, verified);
    }
  }

  return { paints, tamiyaKeyByMasterCode };
}

/**
 * 빈 데이터베이스에 기존 엑셀 데이터를 새 스키마(paints/kits/kitPaintLinks)로 채워넣습니다.
 */
export async function seedInitialData() {
  // 이미 시딩된 적이 있으면 중복 실행을 막음 (더블클릭, 새로고침 후 재시도, 다른 탭 등 모든 경우 대비)
  const existing = await getDocs(query(collection(db, 'kits'), limit(1)));
  if (!existing.empty) {
    throw new Error('이미 초기 데이터가 있습니다. 중복 등록을 막기 위해 다시 실행하지 않았습니다.');
  }

  const { paints, tamiyaKeyByMasterCode } = buildPaintGraph();

  const batch = writeBatch(db);

  // 1) 킷
  const kitIdByName = {};
  DEFAULT_KITS.forEach((kit, idx) => {
    const ref = doc(collection(db, 'kits'));
    kitIdByName[kit.name] = ref.id;
    batch.set(ref, { name: kit.name, manufacturer: kit.manufacturer, productType: kit.productType, order: idx });
  });

  // 2) 도료 — key -> 실제 문서 id 매핑을 먼저 만들고, similarLinks는 targetKey를 실제 id로 치환
  const idByKey = new Map();
  for (const key of paints.keys()) {
    idByKey.set(key, doc(collection(db, 'paints')).id);
  }

  for (const [key, data] of paints.entries()) {
    const ref = doc(db, 'paints', idByKey.get(key));
    batch.set(ref, {
      manufacturer: data.manufacturer,
      paintType: data.paintType,
      code: data.code,
      name: data.name,
      note: data.note,
      owned: data.owned,
      similarLinks: data.similarLinks.map((l) => ({ paintId: idByKey.get(l.targetKey), verified: l.verified })),
    });
  }

  // 3) 킷-도료 연결
  for (const item of tamiyaMasterRaw) {
    const paintKey = tamiyaKeyByMasterCode[item.code_raw];
    const paintId = idByKey.get(paintKey);
    for (const kitName of item.kits_needed || []) {
      const kitId = kitIdByName[kitName];
      if (!kitId || !paintId) continue;
      const ref = doc(collection(db, 'kitPaintLinks'));
      batch.set(ref, { kitId, paintId, source: 'manual' });
    }
  }

  await batch.commit();
}
