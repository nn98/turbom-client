// Public entry point for all backend calls. Route/component code should
// only ever import from "@/lib/api", never reach into mock-client or
// real-client directly.
//
// Mode is decided once by whether VITE_API_BASE_URL is set (see
// docs/spec/api-spec.md "목/실 전환"). Unset = demo mode, backed by the
// existing demo dataset in src/lib/mock-data.ts (see mock-client.ts /
// legacy-adapter.ts). Set = every call goes to the real backend at that
// base URL, using the identical request/response contract defined in
// ./types.
import { mockGetSiteDetail, mockGetUnitDetail, mockSearchSites } from "./mock-client";
import { realGetSiteDetail, realGetUnitDetail, realSearchSites } from "./real-client";
import type { SearchResponse, SiteDetail, UnitDetail } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "");

export const isDemoMode = !API_BASE_URL;

export const searchSites = (query: string): Promise<SearchResponse> =>
  API_BASE_URL ? realSearchSites(API_BASE_URL, query) : mockSearchSites(query);

export const getSiteDetail = (pnu: string): Promise<SiteDetail> =>
  API_BASE_URL ? realGetSiteDetail(API_BASE_URL, pnu) : mockGetSiteDetail(pnu);

export const getUnitDetail = (unitId: string): Promise<UnitDetail> =>
  API_BASE_URL ? realGetUnitDetail(API_BASE_URL, unitId) : mockGetUnitDetail(unitId);

export { ApiRequestError } from "./errors";
export type * from "./types";

// Gray-zone analysis layered on top of UnitDetail — see unit-analysis.ts.
export { buildUnitAnalysis, RISK_LABELS } from "./unit-analysis";
export type { RiskLevel, UnitAnalysis } from "./unit-analysis";

// "이 자리를 지금 누가 쓰고 있는가" (영업 또는 휴업 중인 이력) — see tenancy.ts.
export { findOccupant, isOccupiedStatus } from "./tenancy";
