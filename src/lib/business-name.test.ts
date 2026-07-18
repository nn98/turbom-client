import { describe, expect, it } from "vitest";
import { namesLikelySame, normalizeBusinessName } from "./business-name";

describe("normalizeBusinessName", () => {
  it("removes parentheses and their content, not just the punctuation", () => {
    expect(normalizeBusinessName("씨유(CU) 판교이노베이션랩점")).toBe(
      normalizeBusinessName("씨유 판교이노베이션랩점"),
    );
  });

  it("strips full corporate-entity words wherever they appear", () => {
    expect(normalizeBusinessName("주식회사 이디야")).toBe(normalizeBusinessName("이디야"));
    expect(normalizeBusinessName("이디야 유한회사")).toBe(normalizeBusinessName("이디야"));
  });

  it("strips the single-glyph ㈜ abbreviation", () => {
    expect(normalizeBusinessName("㈜이디야")).toBe(normalizeBusinessName("이디야"));
  });

  it("normalizes full-width characters to half-width via NFKC", () => {
    expect(normalizeBusinessName("씨유（ＣＵ）판교점")).toBe(normalizeBusinessName("씨유 판교점"));
  });

  it("ignores whitespace and common punctuation differences", () => {
    expect(normalizeBusinessName("이디야-커피 강남.점")).toBe(normalizeBusinessName("이디야커피강남점"));
  });
});

describe("namesLikelySame", () => {
  it("matches the CU convenience-store case (parenthesized alias) — 실측 4113111600107130000-U3", () => {
    expect(namesLikelySame("씨유(CU) 판교이노베이션랩점", "씨유 판교이노베이션랩점")).toBe(true);
  });

  it("matches the cafeteria-operator case (shared suffix, not prefix) — 실측 4113111600107170000-U1", () => {
    expect(namesLikelySame("(주)놀유니버스 구내식당", "풀무원푸드앤컬처 놀유니버스 구내식당")).toBe(true);
  });

  it("matches a plain branch-suffix difference (core name is a prefix)", () => {
    expect(namesLikelySame("스타벅스", "스타벅스 강남점")).toBe(true);
  });

  it("matches when both share a corporate-entity word around a differently-punctuated core", () => {
    expect(namesLikelySame("주식회사 이디야커피", "이디야커피(강남점)")).toBe(true);
  });

  it("does not match unrelated business names", () => {
    expect(namesLikelySame("옛날통닭", "행복부동산")).toBe(false);
  });

  it("does not match on a short, generic shared fragment below the minimum length", () => {
    expect(namesLikelySame("가나다식당", "마바사식당")).toBe(false);
  });

  it("respects a custom minSharedLength", () => {
    // "김밥"은 "김밥천국"의 진짜 부분 문자열이다(공유 접두어) — 길이
    // 임계값만 조절해서 통과/불통과가 갈리는지 확인한다.
    expect(namesLikelySame("김밥", "김밥천국", 2)).toBe(true);
    expect(namesLikelySame("김밥", "김밥천국", 3)).toBe(false);
  });

  it("returns false when either name normalizes to empty (e.g. only punctuation)", () => {
    expect(namesLikelySame("(주)", "이디야")).toBe(false);
  });
});
