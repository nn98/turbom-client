import { describe, expect, it } from "vitest";
import {
  administrativePrefixOf,
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
  currentSubCategory: null,
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

describe("administrativePrefixOf", () => {
  it("keeps everything up to and including the 구 token", () => {
    expect(administrativePrefixOf("성남시 수정구")).toBe("성남시 수정구");
  });

  it("drops any trailing tokens after the 구 (e.g. a dong/lot the gate mistakenly matched on)", () => {
    // 재현 시나리오: q가 이미 특정 동까지 포함한 상태에서 동 선택 게이트가
    // 잘못 걸린 경우(예: 건물명이 "OO동"으로 끝나 오인식) 뒤 토큰(신흥동)은
    // 버리고 구까지만 남겨야 선택한 동으로 교체했을 때 "신흥동 신흥동"처럼
    // 중복되지 않는다.
    expect(administrativePrefixOf("성남시 수정구 신흥동")).toBe("성남시 수정구");
  });

  it("falls back to the 시 token when there is no 구", () => {
    expect(administrativePrefixOf("성남시")).toBe("성남시");
  });

  it("returns an empty string when neither 시 nor 구 is present", () => {
    expect(administrativePrefixOf("신흥동")).toBe("");
  });
});

describe("dongCandidateCounts", () => {
  it("counts candidates per distinct dong token", () => {
    const a = candidate({ pnu: "1", jibunAddress: "경기도 성남시 수정구 신흥동 123-4" });
    const b = candidate({ pnu: "2", jibunAddress: "경기도 성남시 수정구 신흥동 123-1" });
    const c1 = candidate({ pnu: "3", jibunAddress: "경기도 성남시 수정구 창곡동 559-4" });
    const c2 = candidate({ pnu: "4", jibunAddress: "경기도 성남시 수정구 창곡동 560-1" });
    const counts = dongCandidateCounts([a, b, c1, c2]);
    expect(counts.get("신흥동")).toBe(2);
    expect(counts.get("창곡동")).toBe(2);
    expect(counts.size).toBe(2);
  });

  it("drops a dong bucket with only 1 matching candidate as noise", () => {
    // 실측 재현(2026-07-17): "창곡동" 검색이 진짜 창곡동 다수 + 실제 동은
    // 복정동인데 주소 문자열에 "창곡동"이 섞여 매칭된 레코드 1건을 함께
    // 반환했다. 이 1건짜리 버킷을 그대로 두면 dongCounts.size가 2가 돼
    // 이미 단일 동으로 좁혀진 검색에도 동 선택 화면이 다시 뜨고, "창곡동"을
    // 다시 선택해도 완전히 같은 쿼리라 같은 잡음이 또 섞여 무한 반복됐다.
    const real1 = candidate({ pnu: "1", jibunAddress: "경기도 성남시 수정구 창곡동 0번지" });
    const real2 = candidate({ pnu: "2", jibunAddress: "경기도 성남시 수정구 창곡동 92-8" });
    const noise = candidate({
      pnu: "3",
      jibunAddress: "경기도 성남시수정구 복정동 창곡동219-2호",
    });
    const counts = dongCandidateCounts([real1, real2, noise]);
    expect(counts.get("창곡동")).toBe(2);
    expect(counts.has("복정동")).toBe(false);
    expect(counts.size).toBe(1);
  });
});

describe("buildSiteMarkers", () => {
  it("drops candidates without coordinates", () => {
    const withCoords = candidate({ pnu: "1" });
    const withoutCoords = candidate({ pnu: "2", latitude: null, longitude: null });
    const markers = buildSiteMarkers([withCoords, withoutCoords], "신흥동", undefined);
    expect(markers.map((m) => m.id)).toEqual(["1"]);
  });

  it("marks only the active candidate (by pnu) as active", () => {
    const a = candidate({ pnu: "1", jibunAddress: "성남시 수정구 신흥동 123-4" });
    const b = candidate({ pnu: "2", jibunAddress: "성남시 수정구 신흥동 123-5" });
    const markers = buildSiteMarkers([a, b], "신흥동", "2");
    expect(markers.find((m) => m.id === "1")?.active).toBe(false);
    expect(markers.find((m) => m.id === "2")?.active).toBe(true);
  });

  it("disambiguates two candidates that share the same jibunAddress text by pnu", () => {
    // 실측 재현(2026-07-18, 금토동 534-8): 산 지번과 일반 지번이 "산" 표기
    // 없이 완전히 같은 jibunAddress 문자열로 내려온다. active 판정을
    // jibunAddress로 했다면 이 경우 두 마커가 동시에 active가 되거나(또는
    // 항상 첫 번째만 찾아져) 두 번째 후보를 영영 선택할 수 없었다.
    const a = candidate({ pnu: "4113111600005340008", jibunAddress: "경기도 성남시 수정구 금토동 534-8" });
    const b = candidate({ pnu: "4113111600105340008", jibunAddress: "경기도 성남시 수정구 금토동 534-8" });
    const markers = buildSiteMarkers([a, b], "금토동 534-8", "4113111600105340008");
    expect(markers.find((m) => m.id === a.pnu)?.active).toBe(false);
    expect(markers.find((m) => m.id === b.pnu)?.active).toBe(true);
  });

  it("returns a value-equal array for value-equal inputs (safe to memoize by content)", () => {
    const candidates = [candidate({ pnu: "1" })];
    const a = buildSiteMarkers(candidates, "신흥동", undefined);
    const b = buildSiteMarkers(candidates, "신흥동", undefined);
    expect(a).toEqual(b);
    expect(a).not.toBe(b); // 참조는 다름 — 호출부가 useMemo로 감싸야 하는 이유
  });
});
