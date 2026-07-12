import type { MapMarker } from "@/components/map-view";
import type { Candidate } from "@/lib/api";

// jibunAddress는 "시/도 시/군/구 동 지번 [건물명] [층·호]" 형태로 건물명·층·호까지
// 이어붙어 있어서 마지막 토큰이 지번이라는 보장이 없다. 검색어에서 동/읍/면/리로
// 끝나는 토큰(행정동 이름)을 찾아 jibunAddress 안에서 그 위치를 앵커로 삼고,
// 바로 다음 토큰(지번)만 탭 라벨로 쓴다. 앵커를 못 찾으면 기존 방식(마지막 토큰)으로 폴백.
const DONG_SUFFIX = /(동|읍|면|리|가)$/;

export const extractLotLabel = (jibunAddress: string, query: string): string => {
  const tokens = jibunAddress.trim().split(/\s+/);
  const queryTokens = query.trim().split(/\s+/).filter(Boolean);
  const dongToken = queryTokens
    .slice()
    .reverse()
    .find((t) => DONG_SUFFIX.test(t));
  if (dongToken) {
    const idx = tokens.findIndex((t) => t === dongToken);
    if (idx !== -1 && idx + 1 < tokens.length) return tokens[idx + 1];
  }
  return tokens[tokens.length - 1] ?? jibunAddress;
};

// candidates 배열이 매 렌더마다(예: 검색창 타이핑으로 인한 SearchPage 리렌더) 새
// 참조로 만들어지면, 이 함수의 결과를 useMemo로 감싸지 않는 한 MapView의 마커
// 렌더 이펙트(`[mapReady, markers]` 의존)가 후보가 실제로 안 바뀌었는데도 매번
// 재실행된다(마커 전부 지웠다 다시 그리기 + fitBounds/setCenter 재계산). 순수
// 함수로 뽑아 호출부(search.tsx)에서 candidates/query/activeJibunAddress가 실제로
// 바뀔 때만 새 배열을 만들도록 useMemo에 넣어 쓴다.
export function buildSiteMarkers(
  candidates: Candidate[],
  query: string,
  activeJibunAddress: string | undefined,
): MapMarker[] {
  return candidates
    .filter((c) => c.latitude != null && c.longitude != null)
    .map((c) => ({
      id: c.pnu,
      lat: c.latitude as number,
      lng: c.longitude as number,
      label: extractLotLabel(c.jibunAddress, query),
      jibunAddress: c.jibunAddress,
      active: c.jibunAddress === activeJibunAddress,
    }));
}
