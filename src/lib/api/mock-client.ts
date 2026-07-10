import { getStoreById, searchByJibun } from "@/lib/mock-data";
import type { JibunGroup, Store } from "@/lib/mock-data";
import {
  computeAverageSurvivalMonths,
  matchedToLocationSource,
  timelineOf,
} from "./legacy-adapter";
import { findOccupant } from "./tenancy";
import { invalidQueryError, siteNotFoundError, unitNotFoundError } from "./errors";
import type { Candidate, SearchResponse, SiteDetail, UnitDetail, UnitSummary } from "./types";

const DISCLAIMER = {
  dataAsOf: "2026-07-04",
  note: "인허가 신고 기준 데이터로 실제 영업 현황과 차이가 있을 수 있습니다.",
};

// Small artificial delay so loading states are exercisable in demo mode.
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// pnu is currently just jibunFull — see legacy-adapter.ts for why.
const toCandidate = (group: JibunGroup): Candidate => ({
  pnu: group.jibunFull,
  jibunAddress: group.jibunFull,
  roadAddress: group.roadAddress,
  latitude: group.lat,
  longitude: group.lng,
  unitCount: group.storeCount,
  closedCount: group.closureCount,
});

const toUnitSummary = (store: Store): UnitSummary => {
  const timeline = timelineOf(store);
  const current = findOccupant(timeline);
  return {
    unitId: store.id,
    label: `${store.floor} ${store.unit}`,
    currentBusinessName: current?.businessName ?? null,
    // UnitSummary.currentStatus는 영업/공실 2단계뿐이라 "휴업"을 담을 자리가
    // 없다 — 아직 문 닫지 않은(occupied) 상태는 전부 "영업"으로 취급하고,
    // 실제 영업/휴업 구분은 UnitDetail.timeline[].status(3단계)에서만 노출한다.
    // TODO(backend): 백엔드 계약에 휴업 상태를 추가할지 논의 필요.
    currentStatus: store.status,
    totalTenancyCount: timeline.length,
    closedCount: timeline.filter((t) => t.status === "폐업").length,
    averageSurvivalMonths: computeAverageSurvivalMonths(timeline),
    industryDetail: current?.industryDetail ?? null,
    locationSource: matchedToLocationSource(store.matched),
  };
};

export const mockSearchSites = async (query: string): Promise<SearchResponse> => {
  await delay(200);
  if (!query || !query.trim()) throw invalidQueryError();
  const result = searchByJibun(query);
  return { candidates: result ? result.groups.map(toCandidate) : [] };
};

export const mockGetSiteDetail = async (pnu: string): Promise<SiteDetail> => {
  await delay(150);
  const result = searchByJibun(pnu);
  const group = result?.groups.find((g) => g.jibunFull === pnu);
  if (!result || !group) throw siteNotFoundError(pnu);
  const stores = result.storesByJibun[group.jibunFull] ?? [];
  return {
    site: {
      pnu: group.jibunFull,
      jibunAddress: group.jibunFull,
      roadAddress: group.roadAddress,
      latitude: group.lat,
      longitude: group.lng,
    },
    units: stores.map(toUnitSummary),
    disclaimer: DISCLAIMER,
  };
};

export const mockGetUnitDetail = async (unitId: string): Promise<UnitDetail> => {
  await delay(150);
  const store = getStoreById(unitId);
  if (!store) throw unitNotFoundError(unitId);
  const timeline = timelineOf(store);
  const survivals = timeline.map((t) => t.survivalMonths).filter((m): m is number => m != null);
  return {
    unit: {
      unitId: store.id,
      label: `${store.floor} ${store.unit}`,
      jibunAddress: store.jibunFull,
      roadAddress: store.roadAddress,
      // mock-data.ts는 이미 floor/unit이 분리되어 있어 백엔드의 파싱 단계가
      // 필요 없다 — 실 백엔드 전용 필드라 항상 null.
      parsedFloor: null,
      parsedUnitNo: null,
      parseConfidence: null,
    },
    statistics: {
      totalTenancyCount: timeline.length,
      closedCount: timeline.filter((t) => t.status === "폐업").length,
      averageSurvivalMonths: computeAverageSurvivalMonths(timeline),
      longestSurvivalMonths: survivals.length ? Math.max(...survivals) : null,
      shortestSurvivalMonths: survivals.length ? Math.min(...survivals) : null,
    },
    timeline,
    disclaimer: DISCLAIMER,
  };
};
