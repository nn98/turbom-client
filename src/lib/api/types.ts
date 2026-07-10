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
  };
  statistics: Statistics;
  timeline: Tenancy[];
  disclaimer: Disclaimer;
}
