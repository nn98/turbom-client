import { findOccupant } from "./tenancy";
import type { UnitDetail } from "./types";

// ── Gray zone ──────────────────────────────────────────────────────────
// riskLevel/narrative/district/checklist have NO equivalent in
// docs/spec/api-spec.md's response contract (SearchResponse/SiteDetail/
// UnitDetail only cover site/unit/tenancy + statistics). Decision: keep
// this entirely as a frontend-side computation layered on top of the real
// UnitDetail response — not waiting on a backend/Edge Function endpoint —
// so it lives here in the service layer rather than scattered across route
// components. If the backend ever starts returning this analysis natively,
// this file is the one place to delete.
//
// `district.composition`/`totalStores`/`sameCategory`/`referenceDate` read
// real data from marketInfo (categoryBreakdown/totalStoreCount/
// sameCategoryNearbyCount/asOf) when present, falling back to static demo
// numbers only when it's absent (mock mode, or a vacant unit with no
// current occupant to read marketInfo from). Per docs/spec/api-spec.md's
// annotated sample response, categoryBreakdown/totalStoreCount are computed
// on a 300m radius and each category's `ratio` is explicitly labeled
// "경쟁률" (competition rate) — `competitionScore` is derived from that
// (sameCategoryNearbyCount as a share of totalStoreCount), but it's still a
// formula WE designed, not a field the backend returns directly; the UI
// caption says so.
//
// `tags`/`insights` used to exist here but were never rendered anywhere in
// report.$storeId.tsx — removed as dead code rather than "fixed" with real
// data nobody would see.
// ──────────────────────────────────────────────────────────────────────

export type RiskLevel = 1 | 2 | 3 | 4 | 5;

export const RISK_LABELS: Record<RiskLevel, string> = {
  1: "매우 안정",
  2: "안정",
  3: "보통",
  4: "위험",
  5: "매우 위험",
};

export interface UnitAnalysis {
  riskLevel: RiskLevel;
  riskLabel: string;
  // 반경 300m 내 동일 업종 점포 수(marketInfo의 유일한 실값, §6 참고)가 5개
  // 미만이면 상권 자체가 희박하다는 신호로 보고 riskLevel을 한 단계 올린다.
  // sameCategoryNearbyCount가 null(집계 실패/미확보)일 땐 판단 근거가 없어
  // 적용하지 않는다 — placeholder 수치(FALLBACK_TOTAL_STORES 등)로는 절대
  // 판단하지 않는다.
  lowNearbyDensity: boolean;
  narrative: string[];
  district: {
    composition: { category: string; count: number; ratio: number }[];
    // categoryBreakdown이 비어 있어(상가API 보강 미동작 등) FALLBACK_* 목업으로
    // 대체됐는지 여부 — report.$storeId.tsx의 DistrictAnalysis가 이 값으로
    // "예시" Badge/칩 표시 여부를 결정한다.
    isPlaceholder: boolean;
    stats: {
      sameCategory: number | null;
      totalStores: number;
      referenceDate: string;
    };
  };
  checklist: { key: string; label: string }[];
}

const riskLevelOf = (closedCount: number): RiskLevel => {
  if (closedCount >= 5) return 5;
  if (closedCount >= 3) return 4;
  if (closedCount === 2) return 3;
  if (closedCount === 1) return 2;
  return 1;
};

// district.composition/totalStores read real data from marketInfo
// (categoryBreakdown/totalStoreCount) when present, falling back to the
// static demo numbers below otherwise. In practice the real branch is
// rarely taken: 2026-07-16 실측(CLAUDE.md "알려진 스펙-실측 차이" 참고)
// 확인 결과 상가API 보강 파이프라인이 실배포에서 100% 미동작이라
// categoryBreakdown이 항상 비어 있다 — 그래서 사실상 항상 아래
// FALLBACK_* 목업으로 대체된다. isPlaceholder가 이 폴백 여부를
// report.$storeId.tsx의 DistrictAnalysis에 알리는 신호다.
const FALLBACK_COMPOSITION = [
  { category: "음식점", count: 62 },
  { category: "카페", count: 34 },
  { category: "주점", count: 21 },
  { category: "편의/생활", count: 28 },
  { category: "서비스", count: 25 },
  { category: "기타", count: 17 },
];
const FALLBACK_TOTAL_STORES = 187;

export const buildUnitAnalysis = (detail: UnitDetail): UnitAnalysis => {
  const { statistics, timeline } = detail;
  // 영업 중이거나 휴업 중인(=아직 폐업하지 않은) 이력을 "현재 점유자"로 본다.
  const current = findOccupant(timeline);
  // 폴백으로 임의의 숫자(예: 14)를 지어내지 않는다 — 실데이터가 없으면 null로
  // 두고 화면에서 "정보 없음"으로 정직하게 표시한다.
  const sameCategoryCount = current?.marketInfo.sameCategoryNearbyCount ?? null;
  const lowNearbyDensity = sameCategoryCount != null && sameCategoryCount < 5;
  const baseRiskLevel = riskLevelOf(statistics.closedCount);
  const riskLevel = lowNearbyDensity
    ? (Math.min(5, baseRiskLevel + 1) as RiskLevel)
    : baseRiskLevel;
  const categoryBreakdown = current?.marketInfo.categoryBreakdown;
  const isPlaceholder = !(categoryBreakdown && categoryBreakdown.length > 0);
  const composition = !isPlaceholder
    ? categoryBreakdown!.map((c) => ({ category: c.name, count: c.count, ratio: c.ratio }))
    : FALLBACK_COMPOSITION.map((c) => ({
        ...c,
        ratio: FALLBACK_TOTAL_STORES > 0 ? c.count / FALLBACK_TOTAL_STORES : 0,
      }));
  const totalStores = current?.marketInfo.totalStoreCount ?? FALLBACK_TOTAL_STORES;
  const referenceDate = current?.marketInfo.asOf ?? "-";

  return {
    riskLevel,
    riskLabel: RISK_LABELS[riskLevel],
    lowNearbyDensity,
    narrative: [
      `최근 관측 기간 중 총 ${statistics.closedCount}회의 폐업이 발생했습니다.`,
      statistics.averageSurvivalMonths != null
        ? `평균 생존기간은 ${statistics.averageSurvivalMonths}개월입니다.`
        : `평균 생존기간을 산출할 이력이 없습니다.`,
      current
        ? current.status === "휴업"
          ? `현재 ${current.businessName}(${current.subCategory})은(는) ${current.survivalMonths}개월째 휴업 중입니다.`
          : `현재 ${current.businessName}(${current.subCategory})은(는) ${current.survivalMonths}개월째 운영 중입니다.`
        : `현재는 공실 상태입니다.`,
      sameCategoryCount != null
        ? `반경 300m 내 동일 업종은 ${sameCategoryCount}개입니다.`
        : `반경 300m 내 동일 업종 수는 집계되지 않았습니다.`,
    ],
    district: {
      composition,
      isPlaceholder,
      stats: {
        sameCategory: sameCategoryCount,
        totalStores,
        referenceDate,
      },
    },
    checklist: [
      { key: "recentTrend", label: "최근 개·폐업 흐름을 확인했습니다" },
      { key: "competitionDensity", label: "경쟁 점포와 상권 밀도를 확인했습니다" },
      { key: "floatingPopulation", label: "유동인구와 주요 고객층을 확인했습니다" },
      { key: "ownerMatch", label: "임대인과 실제 소유자의 일치 여부를 확인했습니다" },
      { key: "licenseEligibility", label: "해당 업종의 인허가 가능 여부를 확인했습니다" },
      { key: "registryDocs", label: "등기부등본과 건축물대장을 확인했습니다" },
      {
        key: "marketRentComparison",
        label: "주변 시세와 임대료·관리비·권리금을 비교했습니다",
      },
      { key: "contractTerms", label: "계약 해지·갱신·원상복구 조건을 확인했습니다" },
    ],
  };
};
