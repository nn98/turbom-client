// Mock dataset for Turbohm (터봄).
// Structured to be swapped for a real API later.

export interface StoreHistory {
  period: string; // "2016-03 — 2017-11"
  start: string; // YYYY-MM
  end: string | null; // null = current
  category: string;
  brand: string;
  months: number;
  current?: boolean;
}

export interface Store {
  id: string;
  jibunBase: string; // e.g. "성남시 수정구 신흥동 123"
  jibunFull: string; // "성남시 수정구 신흥동 123-4"
  buildingName: string;
  roadAddress: string;
  floor: string; // "1층"
  unit: string; // "101호"
  currentCategory: string | null; // null = 공실
  currentMonths: number;
  matched: "상가API 매칭" | "추정 분리" | "공실";
  status: "영업" | "공실";
  summary: string; // short line for list
  history: StoreHistory[];
}

export interface JibunGroup {
  jibunFull: string;
  roadAddress: string;
  storeCount: number;
  closureCount: number;
  lat: number;
  lng: number;
}

export interface AddressSearchResult {
  jibunBase: string; // "성남시 수정구 신흥동 123"
  groups: JibunGroup[];
  storesByJibun: Record<string, Store[]>;
}

// ---- Demo addresses (본번까지) ----
export const DEMO_ADDRESSES = [
  "성남시 수정구 신흥동 123",
  "성남시 분당구 정자동 178",
  "서울시 마포구 서교동 395",
];

// ---- Helpers ----
const makeHistory = (rows: Omit<StoreHistory, "period">[]): StoreHistory[] =>
  rows.map((r) => ({
    ...r,
    period: `${r.start} — ${r.end ?? "현재"}`,
  }));

// ---- Mock stores per jibunFull ----
const stores_123_4: Store[] = [
  {
    id: "sn-123-4-1-101",
    jibunBase: "성남시 수정구 신흥동 123",
    jibunFull: "성남시 수정구 신흥동 123-4",
    buildingName: "신흥프라자",
    roadAddress: "경기도 성남시 수정구 대왕판교로 815",
    floor: "1층",
    unit: "101호",
    currentCategory: "치킨집",
    currentMonths: 41,
    matched: "상가API 매칭",
    status: "영업",
    summary: "치킨나라 · 후라이드/양념치킨 · 가게 5곳 거쳐감 · 폐업 4번",
    history: makeHistory([
      { start: "2016-03", end: "2017-11", category: "분식", brand: "김밥천국", months: 20 },
      { start: "2018-01", end: "2019-06", category: "카페", brand: "이디야", months: 17 },
      { start: "2019-09", end: "2021-02", category: "주점", brand: "청담이상", months: 17 },
      { start: "2021-04", end: "2023-01", category: "편의점", brand: "GS25", months: 21 },
      { start: "2023-02", end: null, category: "치킨집", brand: "교촌치킨", months: 41, current: true },
    ]),
  },
  {
    id: "sn-123-4-2-201",
    jibunBase: "성남시 수정구 신흥동 123",
    jibunFull: "성남시 수정구 신흥동 123-4",
    buildingName: "신흥프라자",
    roadAddress: "경기도 성남시 수정구 대왕판교로 815",
    floor: "2층",
    unit: "201호",
    currentCategory: null,
    currentMonths: 0,
    matched: "추정 분리",
    status: "공실",
    summary: "지금은 비어 있어요 · 가게 3곳 거쳐감 · 폐업 3번 · 평균 14개월",
    history: makeHistory([
      { start: "2017-05", end: "2018-08", category: "학원", brand: "수학의정석", months: 15 },
      { start: "2018-11", end: "2020-01", category: "네일샵", brand: "네일아뜰리에", months: 14 },
      { start: "2020-04", end: "2021-05", category: "스터디카페", brand: "작심스터디", months: 13 },
    ]),
  },
  {
    id: "sn-123-4-1-102",
    jibunBase: "성남시 수정구 신흥동 123",
    jibunFull: "성남시 수정구 신흥동 123-4",
    buildingName: "신흥프라자",
    roadAddress: "경기도 성남시 수정구 대왕판교로 815",
    floor: "1층",
    unit: "102호",
    currentCategory: "제과점",
    currentMonths: 60,
    matched: "상가API 매칭",
    status: "영업",
    summary: "파리바게뜨 · 제과점 · 가게 2곳 거쳐감 · 폐업 1번 · 평균 60개월",
    history: makeHistory([
      { start: "2018-05", end: "2021-01", category: "베이커리", brand: "뚜레쥬르", months: 32 },
      { start: "2021-02", end: null, category: "제과점", brand: "파리바게뜨", months: 60, current: true },
    ]),
  },
];

const stores_123_1: Store[] = [
  {
    id: "sn-123-1-1-101",
    jibunBase: "성남시 수정구 신흥동 123",
    jibunFull: "성남시 수정구 신흥동 123-1",
    buildingName: "신흥타워",
    roadAddress: "경기도 성남시 수정구 대왕판교로 811",
    floor: "1층",
    unit: "101호",
    currentCategory: "카페",
    currentMonths: 8,
    matched: "상가API 매칭",
    status: "영업",
    summary: "스타벅스 · 카페 · 가게 3곳 거쳐감 · 폐업 2번",
    history: makeHistory([
      { start: "2019-01", end: "2021-06", category: "편의점", brand: "CU", months: 30 },
      { start: "2021-09", end: "2024-11", category: "분식", brand: "고봉민김밥", months: 38 },
      { start: "2025-11", end: null, category: "카페", brand: "스타벅스", months: 8, current: true },
    ]),
  },
];

const stores_178_2: Store[] = [
  {
    id: "bd-178-2-1-101",
    jibunBase: "성남시 분당구 정자동 178",
    jibunFull: "성남시 분당구 정자동 178-2",
    buildingName: "정자스퀘어",
    roadAddress: "경기도 성남시 분당구 정자일로 121",
    floor: "1층",
    unit: "101호",
    currentCategory: "커피전문점",
    currentMonths: 28,
    matched: "상가API 매칭",
    status: "영업",
    summary: "블루보틀 · 커피 · 가게 2곳 거쳐감 · 폐업 1번 · 평균 30개월",
    history: makeHistory([
      { start: "2020-04", end: "2023-05", category: "베이커리카페", brand: "폴바셋", months: 37 },
      { start: "2023-11", end: null, category: "커피전문점", brand: "블루보틀", months: 28, current: true },
    ]),
  },
];

const stores_395_10: Store[] = [
  {
    id: "mp-395-10-1-101",
    jibunBase: "서울시 마포구 서교동 395",
    jibunFull: "서울시 마포구 서교동 395-10",
    buildingName: "서교빌딩",
    roadAddress: "서울시 마포구 잔다리로 33",
    floor: "1층",
    unit: "101호",
    currentCategory: null,
    currentMonths: 0,
    matched: "추정 분리",
    status: "공실",
    summary: "지금은 비어 있어요 · 가게 6곳 거쳐감 · 폐업 6번 · 평균 11개월",
    history: makeHistory([
      { start: "2015-01", end: "2016-04", category: "주점", brand: "청춘포차", months: 15 },
      { start: "2016-07", end: "2017-05", category: "카페", brand: "카페베네", months: 10 },
      { start: "2017-09", end: "2018-06", category: "분식", brand: "떡볶이왕", months: 9 },
      { start: "2018-10", end: "2019-08", category: "이자카야", brand: "야마오야", months: 10 },
      { start: "2020-01", end: "2021-04", category: "샐러드", brand: "샐러디", months: 15 },
      { start: "2021-08", end: "2022-05", category: "무인점포", brand: "무인편의점", months: 9 },
    ]),
  },
];

const ADDRESS_INDEX: Record<string, AddressSearchResult> = {
  "성남시 수정구 신흥동 123": {
    jibunBase: "성남시 수정구 신흥동 123",
    groups: [
      { jibunFull: "성남시 수정구 신흥동 123-4", roadAddress: "경기도 성남시 수정구 대왕판교로 815", storeCount: 3, closureCount: 8, lat: 37.4079, lng: 127.1128 },
      { jibunFull: "성남시 수정구 신흥동 123-1", roadAddress: "경기도 성남시 수정구 대왕판교로 811", storeCount: 1, closureCount: 2, lat: 37.408, lng: 127.113 },
    ],
    storesByJibun: {
      "성남시 수정구 신흥동 123-4": stores_123_4,
      "성남시 수정구 신흥동 123-1": stores_123_1,
    },
  },
  "성남시 분당구 정자동 178": {
    jibunBase: "성남시 분당구 정자동 178",
    groups: [
      { jibunFull: "성남시 분당구 정자동 178-2", roadAddress: "경기도 성남시 분당구 정자일로 121", storeCount: 1, closureCount: 1, lat: 37.3671, lng: 127.1086 },
    ],
    storesByJibun: {
      "성남시 분당구 정자동 178-2": stores_178_2,
    },
  },
  "서울시 마포구 서교동 395": {
    jibunBase: "서울시 마포구 서교동 395",
    groups: [
      { jibunFull: "서울시 마포구 서교동 395-10", roadAddress: "서울시 마포구 잔다리로 33", storeCount: 1, closureCount: 6, lat: 37.5547, lng: 126.9223 },
    ],
    storesByJibun: {
      "서울시 마포구 서교동 395-10": stores_395_10,
    },
  },
};

export const searchByJibun = (query: string): AddressSearchResult | null => {
  const q = query.trim().replace(/\s+/g, " ");
  if (!q) return null;
  // Exact match on 본번
  if (ADDRESS_INDEX[q]) return ADDRESS_INDEX[q];
  // Partial: contains
  const key = Object.keys(ADDRESS_INDEX).find(
    (k) => k.includes(q) || q.includes(k) || k.endsWith(q),
  );
  return key ? ADDRESS_INDEX[key] : null;
};

export const getStoreById = (id: string): Store | null => {
  for (const result of Object.values(ADDRESS_INDEX)) {
    for (const stores of Object.values(result.storesByJibun)) {
      const s = stores.find((x) => x.id === id);
      if (s) return s;
    }
  }
  return null;
};

// ---- Analysis report for the report page ----

export type RiskLevel = 1 | 2 | 3 | 4 | 5;

export interface AnalysisReport {
  store: Store;
  observationYears: number;
  summary: {
    riskLevel: RiskLevel;
    riskLabel: string;
    closureCount: number;
    avgSurvivalMonths: number;
    currentCategory: string;
    currentMonths: number;
    sameCategoryCount: number;
    nearbyStoreCount: number;
  };
  narrative: string[];
  district: {
    composition: { category: string; count: number }[];
    competitionScore: number;
    stats: {
      sameCategory: number;
      recentOpenings: number;
      totalStores: number;
      referenceDate: string;
    };
    tags: string[];
  };
  insights: { icon: string; title: string; metric: string; description: string }[];
  stats: {
    self: { label: string; value: string; hint?: string; wide?: boolean }[];
    area: { label: string; value: string; hint?: string; wide?: boolean }[];
  };
  checklist: { key: string; label: string }[];
}

const RISK_LABELS: Record<RiskLevel, string> = {
  1: "매우 안정",
  2: "안정",
  3: "보통",
  4: "위험",
  5: "매우 위험",
};

export const buildReport = (store: Store): AnalysisReport => {
  const closures = store.history.filter((h) => !h.current).length;
  const durations = store.history.filter((h) => !h.current).map((h) => h.months);
  const avg = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : store.currentMonths;
  const max = Math.max(...store.history.map((h) => h.months));
  const min = Math.min(...store.history.map((h) => h.months));

  let riskLevel: RiskLevel = 3;
  if (closures >= 5) riskLevel = 5;
  else if (closures >= 3) riskLevel = 4;
  else if (closures === 2) riskLevel = 3;
  else if (closures === 1) riskLevel = 2;
  else riskLevel = 1;

  const currentCategory = store.currentCategory ?? "공실";

  return {
    store,
    observationYears: 9,
    summary: {
      riskLevel,
      riskLabel: RISK_LABELS[riskLevel],
      closureCount: closures,
      avgSurvivalMonths: avg,
      currentCategory,
      currentMonths: store.currentMonths,
      sameCategoryCount: 14,
      nearbyStoreCount: 148,
    },
    narrative: [
      `최근 9년간 총 ${closures}회의 폐업이 발생했습니다.`,
      `평균 생존기간은 ${avg}개월입니다.`,
      store.currentCategory
        ? `현재 ${currentCategory}은(는) ${store.currentMonths}개월째 운영 중입니다.`
        : `현재는 공실 상태입니다.`,
      `반경 300m 내 동일 업종은 14개입니다.`,
      `최근 창업 활동은 꾸준히 이어지고 있습니다.`,
      `경쟁이 치열한 업종은 운영 이력과 경쟁도를 함께 고려하는 것이 좋습니다.`,
    ],
    district: {
      composition: [
        { category: "음식점", count: 62 },
        { category: "카페", count: 34 },
        { category: "주점", count: 21 },
        { category: "편의/생활", count: 28 },
        { category: "서비스", count: 25 },
        { category: "기타", count: 17 },
      ],
      competitionScore: 74,
      stats: {
        sameCategory: 14,
        recentOpenings: 9,
        totalStores: 187,
        referenceDate: "2026-06-30",
      },
      tags: ["유동인구가 많은 역세권", "음식 업종 밀집 지역", "저녁 소비가 활발한 상권"],
    },
    insights: [
      {
        icon: "trending",
        title: "현재 업종 장기 운영 중",
        metric: `${store.currentMonths}개월`,
        description: "평균 생존기간의 두 배 이상 운영 중입니다.",
      },
      {
        icon: "users",
        title: "반경 내 동일 업종",
        metric: "14개",
        description: "반경 300m 이내에서 유사 업종과 경쟁합니다.",
      },
      {
        icon: "sparkles",
        title: "최근 6개월 신규 개업",
        metric: "9개",
        description: "상권은 활발하지만 경쟁 강도가 함께 상승 중입니다.",
      },
      {
        icon: "clock",
        title: "저녁 소비 중심 상권",
        metric: "저녁 68%",
        description: "저녁 시간대 소비 비중이 높은 상권입니다.",
      },
    ],
    stats: {
      self: [
        { label: "폐업 횟수", value: `${closures}회` },
        { label: "평균 생존기간", value: `${avg}개월` },
        { label: "최장 운영", value: `${max}개월` },
        { label: "최단 운영", value: `${min}개월` },
        { label: "동일 업종 실패", value: "0회", hint: "이 자리에서 동일 업종의 반복 폐업은 관측되지 않았습니다.", wide: true },
      ],
      area: [
        { label: "전체 점포", value: "187" },
        { label: "동일 업종", value: "14" },
        { label: "최근 개업", value: "9", hint: "최근 3개월" },
        { label: "반경", value: "300m" },
        { label: "집계일", value: "2026-06-30", wide: true },
      ],
    },
    checklist: [
      { key: "closure", label: "최근 폐업 횟수를 확인했습니다" },
      { key: "survival", label: "평균 생존기간을 확인했습니다" },
      { key: "sameFail", label: "동일 업종 실패 여부를 확인했습니다" },
      { key: "currentOp", label: "현재 운영기간을 확인했습니다" },
      { key: "competition", label: "경쟁 점포 수를 확인했습니다" },
      { key: "recentOpen", label: "최근 개업 흐름을 확인했습니다" },
      { key: "composition", label: "업종 분포를 확인했습니다" },
      { key: "density", label: "상권 밀도를 확인했습니다" },
    ],
  };
};
