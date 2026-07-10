import { ApiRequestError } from "./errors";
import type { ApiError, SearchResponse, SiteDetail, UnitDetail } from "./types";

const request = async <T>(baseUrl: string, path: string): Promise<T> => {
  const res = await fetch(`${baseUrl}${path}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    throw new ApiRequestError(
      body?.error ?? "INTERNAL_ERROR",
      body?.message ?? `요청이 실패했습니다 (HTTP ${res.status}).`,
      res.status,
    );
  }
  return res.json() as Promise<T>;
};

export const realSearchSites = (baseUrl: string, query: string): Promise<SearchResponse> =>
  request<SearchResponse>(baseUrl, `/api/sites/search?query=${encodeURIComponent(query)}`);

export const realGetSiteDetail = (baseUrl: string, pnu: string): Promise<SiteDetail> =>
  request<SiteDetail>(baseUrl, `/api/sites/${encodeURIComponent(pnu)}`);

export const realGetUnitDetail = (baseUrl: string, unitId: string): Promise<UnitDetail> =>
  request<UnitDetail>(baseUrl, `/api/units/${encodeURIComponent(unitId)}`);
