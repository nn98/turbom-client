import { describe, expect, it } from "vitest";
import { capToNearest, centroidOf, haversineMeters, withinRadius } from "./geo";

describe("haversineMeters", () => {
  it("returns 0 for the same point", () => {
    expect(haversineMeters({ lat: 37.408, lng: 127.113 }, { lat: 37.408, lng: 127.113 })).toBe(0);
  });

  it("matches the known ~111km per degree of latitude", () => {
    const distance = haversineMeters({ lat: 37, lng: 127 }, { lat: 38, lng: 127 });
    expect(distance).toBeGreaterThan(110_000);
    expect(distance).toBeLessThan(112_000);
  });
});

describe("centroidOf", () => {
  it("returns null for an empty list", () => {
    expect(centroidOf([])).toBeNull();
  });

  it("returns the point itself for a single point", () => {
    expect(centroidOf([{ lat: 37.408, lng: 127.113 }])).toEqual({ lat: 37.408, lng: 127.113 });
  });

  it("averages multiple points", () => {
    expect(
      centroidOf([
        { lat: 37, lng: 127 },
        { lat: 39, lng: 129 },
      ]),
    ).toEqual({ lat: 38, lng: 128 });
  });
});

describe("withinRadius", () => {
  // 근사 중심점은 "매칭된 좌표들의 평균"이라 아웃라이어 하나가 평균을 크게
  // 끌어당긴다 — near 쪽을 여러 개로 채워 평균이 near 클러스터 근처에 남게
  // 만들어야 "가까운 건 남고 먼 것만 빠진다"는 의도가 재현된다.
  const near = { latitude: 37.408, longitude: 127.113 };
  const alsoNear = { latitude: 37.4081, longitude: 127.1131 };
  const stillNear = { latitude: 37.4079, longitude: 127.1129 };
  const yetNear = { latitude: 37.408, longitude: 127.1128 };
  const far = { latitude: 37.42, longitude: 127.113 }; // 근사 중심점 기준으로도 300m 밖

  it("keeps candidates close to the centroid and drops the outlier", () => {
    const result = withinRadius([near, alsoNear, stillNear, yetNear, far], 300);
    expect(result).toEqual([near, alsoNear, stillNear, yetNear]);
  });

  it("passes coordinate-less candidates through untouched", () => {
    const noCoords = { latitude: null, longitude: null };
    const result = withinRadius([near, alsoNear, stillNear, yetNear, noCoords], 300);
    expect(result).toContain(noCoords);
  });

  it("falls back to the full list if the radius would drop everything", () => {
    // 두 후보가 서로 11km 떨어져 있으면 평균(중심점)에서도 둘 다 300m를 넘는다 —
    // 근사 중심점의 한계로 전부 잘리는 상황, 안전장치가 원본을 돌려줘야 한다.
    const a = { latitude: 37.0, longitude: 127.0 };
    const b = { latitude: 37.1, longitude: 127.0 };
    expect(withinRadius([a, b], 300)).toEqual([a, b]);
  });

  it("returns the original list unfiltered when nothing has coordinates", () => {
    const items = [{ latitude: null, longitude: null }];
    expect(withinRadius(items, 300)).toEqual(items);
  });
});

describe("capToNearest", () => {
  // 위도만 다르고 경도는 고정 — 중심점(centroid)에서 각 점까지의 거리 순서가
  // 위도 차이만으로 뚜렷하게 갈리도록 구성(동률 없이 정렬 순서를 명확히 검증하기 위함).
  const p1 = { latitude: 37.0, longitude: 127.0 }; // centroid까지 0.004
  const p2 = { latitude: 37.001, longitude: 127.0 }; // 0.003
  const p3 = { latitude: 37.003, longitude: 127.0 }; // 0.001 (가장 가까움)
  const p4 = { latitude: 37.006, longitude: 127.0 }; // 0.002
  const p5 = { latitude: 37.01, longitude: 127.0 }; // 0.006 (가장 멂)
  // centroid lat = (37.000+37.001+37.003+37.006+37.010)/5 = 37.004

  it("returns the list unchanged when it is already at or under the cap", () => {
    const items = [p1, p2];
    expect(capToNearest(items, 5)).toEqual(items);
  });

  it("sorts by distance to the centroid and keeps only the nearest N", () => {
    const result = capToNearest([p1, p2, p3, p4, p5], 3);
    expect(result).toEqual([p3, p4, p2]);
  });

  it("pushes coordinate-less items to the back, so they're dropped first when over the cap", () => {
    const noCoordsA = { latitude: null, longitude: null };
    const noCoordsB = { latitude: null, longitude: null };
    // 좌표 있는 3개(p2,p3,p5) + 좌표 없는 2개 = 5개, 캡 4 →
    // 좌표 없는 두 항목 중 먼저 나온 하나만 개수 안에 들고, 나머지 하나는 잘린다.
    const result = capToNearest([p2, p3, p5, noCoordsA, noCoordsB], 4);
    expect(result).toEqual([p3, p2, p5, noCoordsA]);
  });
});
