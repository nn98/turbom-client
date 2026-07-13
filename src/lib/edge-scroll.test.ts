import { describe, expect, it } from "vitest";
import { edgeScrollState } from "./edge-scroll";

describe("edgeScrollState", () => {
  it("reports no scroll room when content fits entirely", () => {
    expect(edgeScrollState({ scrollLeft: 0, scrollWidth: 300, clientWidth: 400 })).toEqual({
      canScrollLeft: false,
      canScrollRight: false,
    });
  });

  it("reports only right scroll room at the start", () => {
    expect(edgeScrollState({ scrollLeft: 0, scrollWidth: 800, clientWidth: 400 })).toEqual({
      canScrollLeft: false,
      canScrollRight: true,
    });
  });

  it("reports only left scroll room at the end", () => {
    expect(edgeScrollState({ scrollLeft: 400, scrollWidth: 800, clientWidth: 400 })).toEqual({
      canScrollLeft: true,
      canScrollRight: false,
    });
  });

  it("reports both directions in the middle", () => {
    expect(edgeScrollState({ scrollLeft: 200, scrollWidth: 800, clientWidth: 400 })).toEqual({
      canScrollLeft: true,
      canScrollRight: true,
    });
  });
});
