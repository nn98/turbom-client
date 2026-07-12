export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_METERS = 6371000;

export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

export function centroidOf(points: LatLng[]): LatLng | null {
  if (points.length === 0) return null;
  const sum = points.reduce((acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }), {
    lat: 0,
    lng: 0,
  });
  return { lat: sum.lat / points.length, lng: sum.lng / points.length };
}

// 검색 결과가 흩어져 있을 때 "그 행정구역 정중앙"에 가까운 기준점이 있으면
// 좋겠지만, 실제 행정동 경계·중심좌표 데이터는 이 프로젝트에 없다(인허가
// 원본에 지번별 좌표만 있음) — 매칭된 후보들 좌표의 평균을 근사 중심점으로
// 쓴다. 후보가 실제보다 넓게 흩어진 동(넓은 동 일부만 매칭 등)에서는 이 근사가
// 부정확해질 수 있다.
// ponytail: 평균-근사 중심점, 실제 행정동 중심좌표 데이터가 생기면 교체.
export function withinRadius<T extends { latitude: number | null; longitude: number | null }>(
  items: T[],
  radiusMeters: number,
): T[] {
  const locatedPoints = items
    .filter((i) => i.latitude != null && i.longitude != null)
    .map((i) => ({ lat: i.latitude as number, lng: i.longitude as number }));
  const center = centroidOf(locatedPoints);
  if (!center) return items;

  const filtered = items.filter((i) => {
    if (i.latitude == null || i.longitude == null) return true; // 좌표 없으면 판단 불가 — 통과
    return haversineMeters(center, { lat: i.latitude, lng: i.longitude }) <= radiusMeters;
  });
  // 근사 중심점의 한계로 반경 안에 아무것도 안 남으면(예: 후보들이 실제로는
  // 반경보다 넓게 퍼진 경우) 진짜 결과가 사라지는 것보다는 원본을 그대로
  // 보여주는 게 안전하다.
  return filtered.length > 0 ? filtered : items;
}

// withinRadius를 통과하고도 넓은 동/읍 검색어라 반경 안에 수십 개가 남을 수 있다
// (예: 근사 중심점 300m 안에 우연히 몰린 경우) — 중심점에서 가까운 순으로 정렬해
// 상위 N개만 남긴다. 중심점은 withinRadius와 같은 근사(매칭 좌표 평균)를
// centroidOf로 다시 구하되(같은 함수 재사용, 새 계산 로직 없음), 순수 함수로 두어
// withinRadius의 반경 필터와 독립적으로 쓸 수 있게 한다.
export function capToNearest<T extends { latitude: number | null; longitude: number | null }>(
  items: T[],
  maxCount: number,
): T[] {
  if (items.length <= maxCount) return items;

  const locatedPoints = items
    .filter((i) => i.latitude != null && i.longitude != null)
    .map((i) => ({ lat: i.latitude as number, lng: i.longitude as number }));
  const center = centroidOf(locatedPoints);
  if (!center) return items.slice(0, maxCount);

  // 좌표 없는 항목은 거리를 알 수 없으니 무한대 취급 — 정렬 시 맨 뒤로 밀려
  // 캡을 넘길 때 가장 먼저 잘린다(개수에는 포함되되 우선순위는 최하).
  const distanceOf = (i: T) =>
    i.latitude != null && i.longitude != null
      ? haversineMeters(center, { lat: i.latitude, lng: i.longitude })
      : Number.POSITIVE_INFINITY;

  return [...items].sort((a, b) => distanceOf(a) - distanceOf(b)).slice(0, maxCount);
}
