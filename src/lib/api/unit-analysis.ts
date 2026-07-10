import { findOccupant } from "./tenancy";
import type { UnitDetail } from "./types";

// ── Gray zone ──────────────────────────────────────────────────────────
// riskLevel/narrative/district/insights/checklist have NO equivalent in
// docs/backend-api.md's response contract (SearchResponse/SiteDetail/
// UnitDetail only cover site/unit/tenancy + statistics). Decision: keep
// this entirely as a frontend-side computation layered on top of the real
// UnitDetail response — not waiting on a backend/Edge Function endpoint —
// so it lives here in the service layer rather than scattered across route
// components. If the backend ever starts returning this analysis natively,
// this file is the one place to delete.
//
// `district.composition`/`totalStores`/`sameCategory` now read real data
// from marketInfo (categoryBreakdown/totalStoreCount/sameCategoryNearbyCount)
// when present, falling back to static demo numbers only when it's absent
// (mock mode, or a vacant unit with no current occupant). `competitionScore`
// and `tags` remain pure static demo heuristics — the backend has no
// equivalent field for either yet.
// ──────────────────────────────────────────────────────────────────────

export type RiskLevel = 1 | 2 | 3 | 4 | 5;

const RISK_LABELS: Record<RiskLevel, string> = {
  1: "매우 안정",
  2: "안정",
  3: "보통",
  4: "위험",
  5: "매우 위험",
};

export interface UnitAnalysis {
  riskLevel: RiskLevel;
  riskLabel: string;
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
  checklist: { key: string; label: string }[];
}

const riskLevelOf = (closedCount: number): RiskLevel => {
  if (closedCount >= 5) return 5;
  if (closedCount >= 3) return 4;
  if (closedCount === 2) return 3;
  if (closedCount === 1) return 2;
  return 1;
};

// district.composition/totalStores used to be 100% static demo numbers
// (same on every report). The backend's marketInfo now includes real
// categoryBreakdown/totalStoreCount (confirmed 2026-07-10), so those are
// used when present. Falls back to the old static demo numbers only when
// absent — mock mode (legacy-adapter.ts never sets these) or a vacant unit
// with no current occupant to read marketInfo from.
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
  const riskLevel = riskLevelOf(statistics.closedCount);
  const sameCategoryCount = current?.marketInfo.sameCategoryNearbyCount ?? 14;
  const categoryBreakdown = current?.marketInfo.categoryBreakdown;
  const composition =
    categoryBreakdown && categoryBreakdown.length > 0
      ? categoryBreakdown.map((c) => ({ category: c.name, count: c.count }))
      : FALLBACK_COMPOSITION;
  const totalStores = current?.marketInfo.totalStoreCount ?? FALLBACK_TOTAL_STORES;

  return {
    riskLevel,
    riskLabel: RISK_LABELS[riskLevel],
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
      `반경 300m 내 동일 업종은 ${sameCategoryCount}개입니다.`,
    ],
    district: {
      composition,
      competitionScore: 74,
      stats: {
        sameCategory: sameCategoryCount,
        recentOpenings: 9,
        totalStores,
        referenceDate: "2026-06-30",
      },
      tags: ["유동인구가 많은 역세권", "음식 업종 밀집 지역", "저녁 소비가 활발한 상권"],
    },
    insights: [
      current
        ? current.status === "휴업"
          ? {
              icon: "trending",
              title: "현재 휴업 중",
              metric: `${current.survivalMonths}개월`,
              description: "폐업은 아니지만 현재 영업을 쉬고 있는 상태입니다.",
            }
          : {
              icon: "trending",
              title: "현재 업종 장기 운영 중",
              metric: `${current.survivalMonths}개월`,
              description: "평균 생존기간의 두 배 이상 운영 중입니다.",
            }
        : {
            icon: "trending",
            title: "현재 공실",
            metric: "0개월",
            description: "현재 이 자리는 비어 있습니다.",
          },
      {
        icon: "users",
        title: "반경 내 동일 업종",
        metric: `${sameCategoryCount}개`,
        description: "반경 300m 이내에서 유사 업종과 경쟁합니다.",
      },
      {
        icon: "clock",
        title: "저녁 소비 중심 상권",
        metric: "저녁 68%",
        description: "저녁 시간대 소비 비중이 높은 상권입니다.",
      },
    ],
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
