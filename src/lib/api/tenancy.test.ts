import { describe, expect, it } from "vitest";
import { findOccupant, isOccupiedStatus } from "./tenancy";
import type { Tenancy } from "./types";

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
    asOf: "2026-07-11",
    totalStoreCount: null,
    categoryBreakdown: null,
  },
  ...overrides,
});

describe("isOccupiedStatus", () => {
  it("treats 영업 as occupied", () => {
    expect(isOccupiedStatus("영업")).toBe(true);
  });

  it("treats 휴업 as occupied", () => {
    expect(isOccupiedStatus("휴업")).toBe(true);
  });

  it("treats 폐업 as not occupied", () => {
    expect(isOccupiedStatus("폐업")).toBe(false);
  });

  it("treats off-spec license status strings as not occupied", () => {
    // 2026-07-11 실측: 성남시 수정구 표본에서 실제로 관측된 값(CLAUDE.md 참고)
    expect(isOccupiedStatus("취소/말소/만료/정지/중지")).toBe(false);
    expect(isOccupiedStatus("제외/삭제/전출")).toBe(false);
  });
});

describe("findOccupant", () => {
  it("returns the tenancy whose status is 영업", () => {
    const timeline = [
      baseTenancy({ tenancyId: "t-1", status: "폐업", closedAt: "2019-01-01" }),
      baseTenancy({ tenancyId: "t-2", status: "영업" }),
    ];
    expect(findOccupant(timeline)?.tenancyId).toBe("t-2");
  });

  it("returns null when every tenancy is closed or off-spec", () => {
    const timeline = [
      baseTenancy({ tenancyId: "t-1", status: "폐업", closedAt: "2019-01-01" }),
      baseTenancy({
        tenancyId: "t-2",
        status: "취소/말소/만료/정지/중지",
        closedAt: "2021-01-01",
      }),
    ];
    expect(findOccupant(timeline)).toBeNull();
  });
});
