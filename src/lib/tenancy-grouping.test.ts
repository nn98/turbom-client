import { describe, expect, it } from "vitest";
import { groupSimilarOverlappingTenancies } from "./tenancy-grouping";
import type { Tenancy } from "./api";

const t = (overrides: Partial<Tenancy>): Tenancy => ({
  tenancyId: "t-1",
  businessName: "테스트상점",
  category: "음식",
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
    asOf: "2026-07-18",
    totalStoreCount: null,
    categoryBreakdown: null,
  },
  ...overrides,
});

const NOW = "2026-07-18";

describe("groupSimilarOverlappingTenancies", () => {
  it("groups a parenthesized-alias pair that overlaps (실측: 4113111600107130000-U3, 씨유 편의점)", () => {
    const a = t({
      tenancyId: "t-1002",
      businessName: "씨유(CU) 판교이노베이션랩점",
      licensedAt: "2023-04-21",
      closedAt: null,
    });
    const b = t({
      tenancyId: "t-95601",
      businessName: "씨유 판교이노베이션랩점",
      licensedAt: "2023-04-21",
      closedAt: null,
    });
    const groups = groupSimilarOverlappingTenancies([a, b], NOW);
    expect(groups.get("t-1002")).toBe(groups.get("t-95601"));
    expect(groups.get("t-1002")).not.toBeUndefined();
  });

  it("groups an operator-name-prefixed pair sharing a common suffix (실측: 4113111600107170000-U1, 놀유니버스 구내식당)", () => {
    const a = t({
      tenancyId: "t-92304",
      businessName: "(주)놀유니버스 구내식당",
      licensedAt: "2024-10-10",
      closedAt: null,
    });
    const b = t({
      tenancyId: "t-68632",
      businessName: "풀무원푸드앤컬처 놀유니버스 구내식당",
      licensedAt: "2024-10-16",
      closedAt: null,
    });
    const groups = groupSimilarOverlappingTenancies([a, b], NOW);
    expect(groups.get("t-92304")).toBe(groups.get("t-68632"));
    expect(groups.get("t-92304")).not.toBeUndefined();
  });

  it("does not group similarly-named tenancies whose periods don't overlap", () => {
    const a = t({ tenancyId: "t-1", businessName: "이디야커피", licensedAt: "2015-01-01", closedAt: "2017-01-01" });
    const b = t({
      tenancyId: "t-2",
      businessName: "이디야커피 강남점",
      licensedAt: "2020-01-01",
      closedAt: null,
    });
    const groups = groupSimilarOverlappingTenancies([a, b], NOW);
    expect(groups.size).toBe(0);
  });

  it("does not group overlapping tenancies with unrelated names", () => {
    const a = t({ tenancyId: "t-1", businessName: "옛날통닭", licensedAt: "2018-01-01", closedAt: null });
    const b = t({ tenancyId: "t-2", businessName: "행복부동산", licensedAt: "2019-01-01", closedAt: null });
    const groups = groupSimilarOverlappingTenancies([a, b], NOW);
    expect(groups.size).toBe(0);
  });

  it("does not group on a short, generic 2-character shared fragment", () => {
    const a = t({ tenancyId: "t-1", businessName: "가나다식당", licensedAt: "2018-01-01", closedAt: null });
    const b = t({ tenancyId: "t-2", businessName: "마바사식당", licensedAt: "2019-01-01", closedAt: null });
    const groups = groupSimilarOverlappingTenancies([a, b], NOW);
    expect(groups.size).toBe(0);
  });

  it("leaves ungrouped (singleton) tenancies out of the returned map", () => {
    const a = t({ tenancyId: "t-1", businessName: "단독상점", licensedAt: "2018-01-01", closedAt: null });
    const groups = groupSimilarOverlappingTenancies([a], NOW);
    expect(groups.size).toBe(0);
  });
});
