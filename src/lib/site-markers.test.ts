import { describe, expect, it } from "vitest";
import { buildSiteMarkers, extractLotLabel } from "./site-markers";
import type { Candidate } from "./api";

const candidate = (overrides: Partial<Candidate>): Candidate => ({
  pnu: "1",
  jibunAddress: "성남시 수정구 신흥동 123-4",
  roadAddress: "성남시 수정구 산성대로 1",
  latitude: 37.45,
  longitude: 127.15,
  unitCount: 1,
  closedCount: 0,
  ...overrides,
});

describe("extractLotLabel", () => {
  it("anchors on the dong token from the query and returns the next token", () => {
    expect(extractLotLabel("성남시 수정구 신흥동 123-4 상가빌딩 2층", "신흥동 123")).toBe("123-4");
  });

  it("falls back to the last token when no dong suffix is found in the query", () => {
    expect(extractLotLabel("성남시 수정구 신흥동 123-4", "123-4")).toBe("123-4");
  });
});

describe("buildSiteMarkers", () => {
  it("drops candidates without coordinates", () => {
    const withCoords = candidate({ pnu: "1" });
    const withoutCoords = candidate({ pnu: "2", latitude: null, longitude: null });
    const markers = buildSiteMarkers([withCoords, withoutCoords], "신흥동", undefined);
    expect(markers.map((m) => m.id)).toEqual(["1"]);
  });

  it("marks only the active candidate's jibunAddress as active", () => {
    const a = candidate({ pnu: "1", jibunAddress: "성남시 수정구 신흥동 123-4" });
    const b = candidate({ pnu: "2", jibunAddress: "성남시 수정구 신흥동 123-5" });
    const markers = buildSiteMarkers([a, b], "신흥동", "성남시 수정구 신흥동 123-5");
    expect(markers.find((m) => m.id === "1")?.active).toBe(false);
    expect(markers.find((m) => m.id === "2")?.active).toBe(true);
  });

  it("returns a value-equal array for value-equal inputs (safe to memoize by content)", () => {
    const candidates = [candidate({ pnu: "1" })];
    const a = buildSiteMarkers(candidates, "신흥동", undefined);
    const b = buildSiteMarkers(candidates, "신흥동", undefined);
    expect(a).toEqual(b);
    expect(a).not.toBe(b); // 참조는 다름 — 호출부가 useMemo로 감싸야 하는 이유
  });
});
