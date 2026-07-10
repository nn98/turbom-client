import type { Store, StoreHistory } from "@/lib/mock-data";
import type { LocationSource, MarketInfo, Tenancy } from "./types";

// Bridges the existing demo dataset (src/lib/mock-data.ts) to the
// docs/backend-api.md response shape, WITHOUT introducing a second/parallel
// mock dataset. The app keeps running on the same demo content and the same
// ids (Store.id === unitId) it always has — only the shape at the service
// layer boundary is translated.
//
// Known gaps to close later, once real backend integration starts (see
// docs/backend-api.md):
// - `pnu` is a placeholder equal to `jibunFull`, not a real 19-digit PNU.
// - `category`(대분류)/`subCategory` are approximated below; mock-data.ts
//   only ever tracked one granularity ("치킨집" 등).
// - `marketInfo` numbers are synthesized (see buildMarketInfo), matching
//   docs/backend-api.md's "항상 목업(isPlaceholder: true)" contract.

// subCategory(mock-data.ts의 기존 category 값) → category(인허가 대분류) 근사치.
const SUB_TO_CATEGORY: Record<string, string> = {
  분식: "음식_분식점영업",
  카페: "음식_휴게음식점영업",
  주점: "음식_단란주점영업",
  편의점: "소매업_슈퍼마켓및일용잡화점",
  치킨집: "음식_일반음식점영업",
  베이커리: "음식_제과점영업",
  제과점: "음식_제과점영업",
  학원: "교육서비스업_학원",
  네일샵: "서비스업_미용업",
  스터디카페: "서비스업_다중이용시설",
  커피전문점: "음식_휴게음식점영업",
  베이커리카페: "음식_제과점영업",
  이자카야: "음식_일반음식점영업",
  샐러드: "음식_휴게음식점영업",
  무인점포: "소매업_무인판매업",
};

// brand(현재 영업중인 경우만) → industryDetail(상가API 세부업종) 근사치.
const INDUSTRY_DETAIL: Record<string, string> = {
  교촌치킨: "후라이드/양념치킨전문점",
  파리바게뜨: "프랜차이즈 베이커리",
  스타벅스: "커피전문점",
  블루보틀: "스페셜티커피전문점",
};

// Deterministic pseudo-random in [0, 1), seeded by string so SSR and CSR
// renders agree (Math.random() would cause hydration mismatches here).
const seededUnit = (seed: string, salt: number) => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const x = Math.sin(h + salt) * 10000;
  return x - Math.floor(x);
};

export const buildMarketInfo = (tenancyId: string, isCurrent: boolean): MarketInfo => ({
  isPlaceholder: true,
  leaseAreaSqm: Math.round((20 + seededUnit(tenancyId, 1) * 60) * 10) / 10,
  depositKrw: Math.round(2000 + seededUnit(tenancyId, 2) * 8000) * 10000,
  monthlyRentKrw: Math.round(80 + seededUnit(tenancyId, 3) * 200) * 10000,
  keyMoneyKrw: Math.round(1000 + seededUnit(tenancyId, 4) * 5000) * 10000,
  dailyFloatingPopulation: Math.round(3000 + seededUnit(tenancyId, 5) * 12000),
  sameCategoryNearbyCount: isCurrent ? Math.round(4 + seededUnit(tenancyId, 6) * 20) : null,
  vacancyRatePercent: Math.round(seededUnit(tenancyId, 7) * 25 * 10) / 10,
  asOf: "2026-06-30",
  // mock-data.ts에는 상권 업종 구성 데이터가 없다 — unit-analysis.ts가 null일
  // 때 데모용 고정값으로 폴백한다.
  totalStoreCount: null,
  categoryBreakdown: null,
});

export const matchedToLocationSource = (matched: Store["matched"]): LocationSource => {
  switch (matched) {
    case "상가API 매칭":
      return "sangga_api";
    case "추정 분리":
      return "overlap_inferred";
    default:
      // "공실" 등 legacy 데이터셋에 실제로는 쓰이지 않는 값에 대한 폴백.
      return "license";
  }
};

export const toTenancy = (unitId: string, index: number, h: StoreHistory): Tenancy => {
  const tenancyId = `${unitId}-t${index + 1}`;
  const isCurrent = !!h.current;
  const status = h.status ?? (isCurrent ? "영업" : "폐업");
  const industryDetail = isCurrent ? (INDUSTRY_DETAIL[h.brand] ?? null) : null;
  return {
    tenancyId,
    businessName: h.brand,
    category: SUB_TO_CATEGORY[h.category] ?? "음식_일반음식점영업",
    subCategory: h.category,
    industryDetail,
    licensedAt: `${h.start}-01`,
    closedAt: h.end ? `${h.end}-01` : null,
    status,
    survivalMonths: h.months,
    closedAtEstimated: false,
    enrichmentSource: industryDetail ? "sangga_api" : "license_only",
    marketInfo: buildMarketInfo(tenancyId, isCurrent),
  };
};

export const timelineOf = (store: Store): Tenancy[] =>
  store.history.map((h, i) => toTenancy(store.id, i, h));

// 평균/최장/최단 생존기간은 확정적으로 문 닫은(폐업) 이력만 집계한다.
// 휴업은 아직 survivalMonths/closedAt이 확정되지 않은 상태이므로 제외.
export const computeAverageSurvivalMonths = (timeline: Tenancy[]): number | null => {
  const closed = timeline.filter((t) => t.status === "폐업");
  if (!closed.length) return null;
  const sum = closed.reduce((acc, t) => acc + (t.survivalMonths ?? 0), 0);
  return Math.round(sum / closed.length);
};
