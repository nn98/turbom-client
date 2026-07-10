// Response contract mirrored from docs/backend-api.md.
// Both the mock client and the real client must resolve to these exact shapes
// so route/component code never needs to know which one is active.

export interface Disclaimer {
  dataAsOf: string;
  note: string;
}

export interface ApiError {
  error: string;
  message: string;
}

// ---- ① search ----
export interface Candidate {
  pnu: string;
  jibunAddress: string;
  roadAddress: string;
  latitude: number | null;
  longitude: number | null;
  unitCount: number;
  closedCount: number;
}

export interface SearchResponse {
  candidates: Candidate[];
}

// ---- ② site 상세 ----
export type LocationSource = "license" | "sangga_api" | "overlap_inferred";

export interface UnitSummary {
  unitId: string;
  label: string;
  currentBusinessName: string | null;
  currentStatus: "영업" | "공실";
  totalTenancyCount: number;
  closedCount: number;
  averageSurvivalMonths: number | null;
  industryDetail: string | null;
  locationSource: LocationSource;
}

export interface SiteDetail {
  site: {
    pnu: string;
    jibunAddress: string;
    roadAddress: string;
    latitude: number | null;
    longitude: number | null;
  };
  units: UnitSummary[];
  disclaimer: Disclaimer;
}

// ---- ③ unit 상세 ----
export type EnrichmentSource = "sangga_api" | "license_only";

export interface Statistics {
  totalTenancyCount: number;
  closedCount: number;
  averageSurvivalMonths: number | null;
  longestSurvivalMonths: number | null;
  shortestSurvivalMonths: number | null;
}

export interface CategoryBreakdownItem {
  code: string;
  name: string;
  count: number;
  ratio: number;
}

export interface MarketInfo {
  isPlaceholder: boolean;
  leaseAreaSqm: number | null;
  depositKrw: number | null;
  monthlyRentKrw: number | null;
  keyMoneyKrw: number | null;
  dailyFloatingPopulation: number | null;
  sameCategoryNearbyCount: number | null;
  vacancyRatePercent: number | null;
  asOf: string;
  // Real (non-placeholder) 상권 데이터 — 관측된 응답에선 항상 채워져 있었지만
  // 이전 응답 캐시나 데이터 없는 지역 대비 nullable로 취급.
  totalStoreCount: number | null;
  categoryBreakdown: CategoryBreakdownItem[] | null;
}

export interface Tenancy {
  tenancyId: string;
  businessName: string;
  category: string;
  subCategory: string;
  industryDetail: string | null;
  licensedAt: string;
  closedAt: string | null;
  status: "영업" | "폐업" | "휴업";
  survivalMonths: number | null;
  closedAtEstimated: boolean;
  enrichmentSource: EnrichmentSource;
  marketInfo: MarketInfo;
}

export interface UnitDetail {
  unit: {
    unitId: string;
    label: string;
    jibunAddress: string;
    roadAddress: string;
    // 백엔드가 label 문자열에서 층/호수를 파싱한 결과. 전체 enum은 미확인 —
    // 지금까지 관측된 값은 "HIGH" 뿐이라 느슨하게 string으로 둔다.
    parsedFloor: string | null;
    parsedUnitNo: string | null;
    parseConfidence: string | null;
  };
  statistics: Statistics;
  timeline: Tenancy[];
  disclaimer: Disclaimer;
}
