import { useQuery } from "@tanstack/react-query";
import { ApiRequestError, getSiteDetail, getUnitDetail, searchSites } from "@/lib/api";

// Centralized so invalidation/prefetch call sites stay in sync with the
// keys actually used by the hooks below.
export const siteQueryKeys = {
  search: (query: string) => ["sites", "search", query] as const,
  detail: (pnu: string) => ["sites", "detail", pnu] as const,
  unit: (unitId: string) => ["units", "detail", unitId] as const,
};

// 4xx (INVALID_QUERY/SITE_NOT_FOUND/UNIT_NOT_FOUND) won't succeed on retry,
// so don't burn the default 3 retries on them — only retry transient
// failures (network errors, 5xx).
const retryUnlessClientError = (failureCount: number, error: unknown) => {
  if (error instanceof ApiRequestError && error.status < 500) return false;
  return failureCount < 2;
};

export function useSiteSearch(query: string) {
  return useQuery({
    queryKey: siteQueryKeys.search(query),
    queryFn: () => searchSites(query),
    enabled: query.trim().length > 0,
    retry: retryUnlessClientError,
  });
}

export function useSiteDetail(pnu: string | undefined) {
  return useQuery({
    queryKey: siteQueryKeys.detail(pnu ?? ""),
    queryFn: () => getSiteDetail(pnu!),
    enabled: !!pnu,
    retry: retryUnlessClientError,
  });
}

export function useUnitDetail(unitId: string | undefined) {
  return useQuery({
    queryKey: siteQueryKeys.unit(unitId ?? ""),
    queryFn: () => getUnitDetail(unitId!),
    enabled: !!unitId,
    retry: retryUnlessClientError,
  });
}
