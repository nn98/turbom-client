import { describe, expect, it } from "vitest";
import { buildUnitAnalysis } from "./unit-analysis";
import type { Tenancy, UnitDetail } from "./types";

const baseTenancy = (overrides: Partial<Tenancy>): Tenancy => ({
  tenancyId: "t-1",
  businessName: "테스트상점",
  category: "음식_일반음식점영업",
  subCategory: "일반음식점",
  industryDetail: null,
  licensedAt: "2020-01-01",
  closedAt: null,
  status: "영업",
  survivalMonths: 12,
  closedAtEstimated: false,
  enrichmentSource: "license_only",
  marketInfo: {
    isPlaceholder: true,
    leaseAreaSqm: null,
    depositKrw: null,
    monthlyRentKrw: null,
    keyMoneyKrw: null,
    dailyFloatingPopulation: null,
    sameCategoryNearbyCount: null,
    vacancyRatePercent: null,
    asOf: "2026-07-16",
    totalStoreCount: null,
    categoryBreakdown: null,
  },
  ...overrides,
});

const baseDetail = (timeline: Tenancy[]): UnitDetail => ({
  unit: {
    unitId: "u-1",
    label: "1층 101호",
    jibunAddress: "경기도 성남시 수정구 신흥동 123-4",
    roadAddress: "경기도 성남시 수정구 산성대로1번길 1",
    parsedFloor: null,
    parsedUnitNo: null,
    parseConfidence: null,
  },
  statistics: {
    totalTenancyCount: timeline.length,
    closedCount: timeline.filter((t) => t.status === "폐업").length,
    averageSurvivalMonths: 24,
    longestSurvivalMonths: 36,
    shortestSurvivalMonths: 12,
  },
  timeline,
  disclaimer: { dataAsOf: "2026-07-16", note: "" },
});

describe("buildUnitAnalysis district.isPlaceholder", () => {
  it("is true when there is no current occupant to read marketInfo from", () => {
    const detail = baseDetail([baseTenancy({ status: "폐업", closedAt: "2020-06-01" })]);
    expect(buildUnitAnalysis(detail).district.isPlaceholder).toBe(true);
  });

  it("is true when the occupant's marketInfo.categoryBreakdown is null", () => {
    const detail = baseDetail([baseTenancy({ status: "영업" })]);
    expect(buildUnitAnalysis(detail).district.isPlaceholder).toBe(true);
  });

  it("is true when categoryBreakdown is an empty array", () => {
    const detail = baseDetail([
      baseTenancy({
        status: "영업",
        marketInfo: {
          isPlaceholder: false,
          leaseAreaSqm: null,
          depositKrw: null,
          monthlyRentKrw: null,
          keyMoneyKrw: null,
          dailyFloatingPopulation: null,
          sameCategoryNearbyCount: 3,
          vacancyRatePercent: null,
          asOf: "2026-07-16",
          totalStoreCount: 120,
          categoryBreakdown: [],
        },
      }),
    ]);
    expect(buildUnitAnalysis(detail).district.isPlaceholder).toBe(true);
  });

  it("is false when the occupant has real categoryBreakdown data", () => {
    const detail = baseDetail([
      baseTenancy({
        status: "영업",
        marketInfo: {
          isPlaceholder: false,
          leaseAreaSqm: null,
          depositKrw: null,
          monthlyRentKrw: null,
          keyMoneyKrw: null,
          dailyFloatingPopulation: null,
          sameCategoryNearbyCount: 3,
          vacancyRatePercent: null,
          asOf: "2026-07-16",
          totalStoreCount: 120,
          categoryBreakdown: [{ code: "Q01", name: "음식점", count: 50, ratio: 0.4 }],
        },
      }),
    ]);
    expect(buildUnitAnalysis(detail).district.isPlaceholder).toBe(false);
  });
});

describe("buildUnitAnalysis lowNearbyDensity / riskLevel bump", () => {
  const withSameCategoryCount = (n: number | null) =>
    baseDetail([
      baseTenancy({
        status: "영업",
        marketInfo: {
          isPlaceholder: false,
          leaseAreaSqm: null,
          depositKrw: null,
          monthlyRentKrw: null,
          keyMoneyKrw: null,
          dailyFloatingPopulation: null,
          sameCategoryNearbyCount: n,
          vacancyRatePercent: null,
          asOf: "2026-07-16",
          totalStoreCount: null,
          categoryBreakdown: null,
        },
      }),
    ]);

  it("is false and leaves riskLevel unchanged when sameCategoryNearbyCount is null (not collected)", () => {
    const analysis = buildUnitAnalysis(withSameCategoryCount(null));
    expect(analysis.lowNearbyDensity).toBe(false);
    expect(analysis.riskLevel).toBe(1);
  });

  it("is false when sameCategoryNearbyCount is 5 or more", () => {
    const analysis = buildUnitAnalysis(withSameCategoryCount(5));
    expect(analysis.lowNearbyDensity).toBe(false);
    expect(analysis.riskLevel).toBe(1);
  });

  it("is true and bumps riskLevel by 1 when sameCategoryNearbyCount is under 5", () => {
    const analysis = buildUnitAnalysis(withSameCategoryCount(4));
    expect(analysis.lowNearbyDensity).toBe(true);
    expect(analysis.riskLevel).toBe(2); // base 1(폐업 0회) + 1
  });

  it("caps the bumped riskLevel at 5 instead of overflowing", () => {
    const detail = baseDetail([
      baseTenancy({ status: "폐업", closedAt: "2020-01-01" }),
      baseTenancy({ status: "폐업", closedAt: "2020-02-01" }),
      baseTenancy({ status: "폐업", closedAt: "2020-03-01" }),
      baseTenancy({ status: "폐업", closedAt: "2020-04-01" }),
      baseTenancy({
        status: "영업",
        marketInfo: {
          isPlaceholder: false,
          leaseAreaSqm: null,
          depositKrw: null,
          monthlyRentKrw: null,
          keyMoneyKrw: null,
          dailyFloatingPopulation: null,
          sameCategoryNearbyCount: 1,
          vacancyRatePercent: null,
          asOf: "2026-07-16",
          totalStoreCount: null,
          categoryBreakdown: null,
        },
      }),
    ]);
    const analysis = buildUnitAnalysis(detail);
    expect(analysis.lowNearbyDensity).toBe(true);
    expect(analysis.riskLevel).toBe(5);
  });
});
