import { describe, expect, it } from "vitest";
import {
  buildSiteMarkers,
  dongCandidateCounts,
  extractDongToken,
  extractLotLabel,
} from "./site-markers";
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

  it("strips a trailing non-numeric suffix like '번지' for label consistency", () => {
    expect(extractLotLabel("성남시 수정구 신흥동 123번지 상가빌딩", "신흥동 123")).toBe("123");
  });

  it("keeps a lot number with a sub-number intact after stripping the suffix", () => {
    expect(extractLotLabel("성남시 수정구 신흥동 123-4번지", "신흥동 123")).toBe("123-4");
  });

  it("does not strip suffixes on the fallback (unanchored) path — only the anchored path normalizes", () => {
    expect(extractLotLabel("성남시 수정구 신흥동 123-4 상가빌딩 2층", "123-4")).toBe("2층");
  });
});

describe("extractDongToken", () => {
  it("finds the dong token between the 구 token and the lot number", () => {
    expect(extractDongToken("경기도 성남시 수정구 신흥동 123-4")).toBe("신흥동");
  });

  it("works without a leading 시/도 prefix", () => {
    expect(extractDongToken("성남시 수정구 창곡동 559-4")).toBe("창곡동");
  });

  it("returns null when there is no dong-suffix token before the lot number", () => {
    expect(extractDongToken("경기도 성남시 수정구 100")).toBeNull();
  });

  it("returns null for an address with no recognizable suffix at all", () => {
    expect(extractDongToken("알수없는주소형식")).toBeNull();
  });
});

describe("dongCandidateCounts", () => {
  it("counts candidates per distinct dong token", () => {
    const a = candidate({ pnu: "1", jibunAddress: "경기도 성남시 수정구 신흥동 123-4" });
    const b = candidate({ pnu: "2", jibunAddress: "경기도 성남시 수정구 신흥동 123-1" });
    const c = candidate({ pnu: "3", jibunAddress: "경기도 성남시 수정구 창곡동 559-4" });
    const counts = dongCandidateCounts([a, b, c]);
    expect(counts.get("신흥동")).toBe(2);
    expect(counts.get("창곡동")).toBe(1);
    expect(counts.size).toBe(2);
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
