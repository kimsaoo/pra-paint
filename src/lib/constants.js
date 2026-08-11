// ===== 도료(Paint) 관련 =====
export const PAINT_MANUFACTURERS = [
  'Tamiya', 'Vallejo', 'MIG', 'AK', 'GCI', 'Testor', 'Italeri', 'Academy', '기타',
];
// ⚠️ 원 요청 목록(tamiya/Vallejo/mig/AK/GCI/testor/Italeri/기타)에 'Academy'를 추가함.
// 기존 보유목록에 아카데미 에나멜 24종이 있어 마이그레이션 시 갈 곳이 필요했음 — 필요 없으면 알려주세요.

export const PAINT_TYPES = [
  '락커스프레이', '아크릴스프레이', '에나멜', '아크릴', '락커(병)', '기타',
];

// ===== 킷(Kit) 관련 — 도료와 별도 목록 =====
export const KIT_MANUFACTURERS = [
  'Tamiya', 'Academy', 'Meng', 'Heller', 'Italeri', 'Takom', 'Dragon',
  'Bronco', 'AFV Club', 'Hasegawa', 'Finemold',
];

export const PRODUCT_TYPES = ['AFV', 'AUTO', 'BIKE', 'SHIP'];

// 기존 5개 킷 마이그레이션용 초기값 (제조사/타입 지정 필요해서 임의 배정 — 필요시 킷관리에서 수정)
export const DEFAULT_KITS = [
  { name: "Suzuki GSX-RR '20", manufacturer: 'Tamiya', productType: 'BIKE' },
  { name: 'Ducati Superleggera V4', manufacturer: 'Tamiya', productType: 'BIKE' },
  { name: 'Mercedes-AMG GT3', manufacturer: 'Tamiya', productType: 'AUTO' },
  { name: 'McLaren Senna', manufacturer: 'Tamiya', productType: 'AUTO' },
  { name: 'Kawasaki Ninja H2 CARBON', manufacturer: 'Tamiya', productType: 'BIKE' },
];

// 미검증 색상군 키워드 (인수인계 문서 5번 섹션) — 마이그레이션 시 유사도료 검증여부 판정에 사용
export const UNVERIFIED_KEYWORDS = {
  MIG: ['gold', 'purple', 'dark blue', 'grey', 'gray', 'flat brown', 'buff'],
  AK: ['steel', 'blue', 'orange', 'gold', 'grey', 'gray', 'brown', 'buff', 'purple'],
};

// 브랜드칩 등 UI 색상용
const BRAND_COLORS = {
  Tamiya: '#C1502E', Vallejo: '#3E6FA0', MIG: '#D98A2B', AK: '#4F7942',
  GCI: '#6B5B95', Testor: '#8B8378', Italeri: '#8B8378', Academy: '#8B8378', '기타': '#6E6259',
};
export function brandColorVar(manufacturer) {
  return BRAND_COLORS[manufacturer] || BRAND_COLORS['기타'];
}
