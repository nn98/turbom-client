import type { ApiError } from "./types";

// Thrown by both the mock client and the real client so callers (loaders,
// TanStack Query hooks, etc.) can branch on `.code` without caring which
// backend actually produced the failure.
export class ApiRequestError extends Error {
  code: ApiError["error"];
  status: number;

  constructor(code: ApiError["error"], message: string, status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
    this.status = status;
  }
}

export const invalidQueryError = () =>
  new ApiRequestError("INVALID_QUERY", "query 파라미터가 필요합니다.", 400);

export const siteNotFoundError = (pnu: string) =>
  new ApiRequestError("SITE_NOT_FOUND", `pnu(${pnu})에 해당하는 자리를 찾을 수 없습니다.`, 404);

export const unitNotFoundError = (unitId: string) =>
  new ApiRequestError(
    "UNIT_NOT_FOUND",
    `unitId(${unitId})에 해당하는 물건을 찾을 수 없습니다.`,
    404,
  );
