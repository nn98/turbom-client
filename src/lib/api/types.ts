// Response contract mirrored from docs/spec/api-spec.md.
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
  // 현재 영업 중인 첫 번째 물건의 인허가 소분류. 전체 공실이면 null. Sangga
  // API를 호출하지 않고 인허가 데이터만으로 나오는 값이라 항상 신뢰 가능.
  currentSubCategory: string | null;
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

// 물리적 자리(Unit) 개념이 없는 업종의 인허가 이력(통신판매업 등, 원본에
// 층/호 정보가 구조적으로 없는 업종) — `units[]`와 배타적. 실측 확인
// 2026-07-18(CLAUDE.md "알려진 스펙-실측 차이" 참고). 아직 어느 화면에도
// 노출하지 않음 — 타입만 계약에 맞춰 반영.
export interface NoStorefrontRegistration {
  businessName: string;
  category: string;
  subCategory: string;
  licensedAt: string;
  closedAt: string | null;
  status: string;
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
  noStorefrontRegistrations: NoStorefrontRegistration[];
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
  // api-spec.md는 "영업"|"폐업"|"휴업" 3값만 선언하지만, 실 배포 백엔드는
  // 인허가 원본 상태값을 그대로 흘려보내는 경우가 있다(예:
  // "취소/말소/만료/정지/중지", "제외/삭제/전출" — 2026-07-11 실측, CLAUDE.md
  // "알려진 스펙-실측 차이" 참고). "영업"/"휴업"만 코드가 실제로 분기하는
  // 값이라 리터럴로 남기고, 나머지(폐업 포함)는 string으로 수용한다 —
  // isOccupiedStatus()로 판정할 것.
  status: "영업" | "휴업" | (string & {});
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
