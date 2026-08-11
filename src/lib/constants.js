export const DEFAULT_KITS = [
  "Suzuki GSX-RR '20",
  'Ducati Superleggera V4',
  'Mercedes-AMG GT3',
  'McLaren Senna',
  'Kawasaki Ninja H2 CARBON',
];

// 아크릴 도료(진짜 보유 목록, 시트C 대응)
export const ACRYLIC_BRANDS = [
  { key: 'vallejo', label: 'Vallejo', varName: '--vallejo' },
  { key: 'mig', label: 'MIG/AMMO', varName: '--mig' },
  { key: 'ak', label: 'AK Interactive', varName: '--ak' },
];

// 아크릴 제외 도료목록 (시트B 대응)
export const OTHER_BRANDS = [
  { key: 'tamiya_enamel_lacquer', label: '타미야 에나멜 (X/XF)', varName: '--tamiya' },
  { key: 'tamiya_ts_lp', label: '타미야 락카 (TS/LP)', varName: '--tamiya' },
  { key: 'academy_enamel', label: '아카데미 에나멜', varName: '--academy' },
  { key: 'gunze_hobby_color', label: '군제 Hobby Color', varName: '--gunze' },
  { key: 'gunze_lacquer_s', label: '군제 락카 S시리즈', varName: '--gunze' },
  { key: 'other_testor_italeri', label: '기타 (Testor/Italeri)', varName: '--other' },
];

export const ALL_BRANDS = [
  ...ACRYLIC_BRANDS,
  ...OTHER_BRANDS,
  { key: 'tamiya', label: 'Tamiya', varName: '--tamiya' },
];

export function brandLabel(key) {
  return ALL_BRANDS.find((b) => b.key === key)?.label || key;
}

export function brandVar(key) {
  return ALL_BRANDS.find((b) => b.key === key)?.varName || '--other';
}

// 미검증 색상군 키워드 (인수인계 문서 5번 섹션)
export const UNVERIFIED_KEYWORDS = {
  mig: ['gold', 'purple', 'dark blue', 'grey', 'gray', 'flat brown', 'buff'],
  ak: ['steel', 'blue', 'orange', 'gold', 'grey', 'gray', 'brown', 'buff', 'purple'],
};
