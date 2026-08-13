// ===== 도료(Paint) 관련 =====
// 초기 부트스트랩 시 참고용 (실제로는 기존 도료/킷 데이터에서 실사용 중인 제조사를 스캔해서
// paintManufacturers/kitManufacturers 컬렉션을 만듦 - App.jsx의 ensureManufacturerLists 참고)
export const FALLBACK_PAINT_MANUFACTURERS = [
  'Tamiya', 'Vallejo', 'MIG', 'AK', 'GSI', 'Testor', 'Italeri', 'Academy', '기타',
];
export const FALLBACK_KIT_MANUFACTURERS = [
  'Tamiya', 'Academy', 'Meng', 'Heller', 'Italeri', 'Takom', 'Dragon',
  'Bronco', 'AFV Club', 'Hasegawa', 'Finemold',
];

export const PAINT_TYPES = [
  '락커스프레이', '아크릴스프레이', '에나멜', '아크릴', '락커(병)', '기타',
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
  GSI: '#6B5B95', GCI: '#6B5B95', Testor: '#8B8378', Italeri: '#8B8378', Academy: '#8B8378', '기타': '#6E6259',
};
export function brandColorVar(manufacturer) {
  return BRAND_COLORS[manufacturer] || BRAND_COLORS['기타'];
}

// 제조사 아이콘용 이니셜 (실제 브랜드 로고 대신 - 저작권 문제 없는 자체 표기)
const BRAND_INITIALS = {
  Tamiya: 'T', Vallejo: 'V', MIG: 'M', AK: 'AK', GSI: 'G', GCI: 'G',
  Testor: 'TE', Italeri: 'IT', Academy: 'A', '기타': '?',
};
export function brandInitials(manufacturer) {
  if (BRAND_INITIALS[manufacturer]) return BRAND_INITIALS[manufacturer];
  if (!manufacturer) return '?';
  return manufacturer.slice(0, 2).toUpperCase();
}
