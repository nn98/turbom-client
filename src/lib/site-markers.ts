import type { MapMarker } from "@/components/map-view";
import type { Candidate } from "@/lib/api";

// jibunAddress는 "시/도 시/군/구 동 지번 [건물명] [층·호]" 형태로 건물명·층·호까지
// 이어붙어 있어서 마지막 토큰이 지번이라는 보장이 없다. 검색어에서 동/읍/면/리로
// 끝나는 토큰(행정동 이름)을 찾아 jibunAddress 안에서 그 위치를 앵커로 삼고,
// 바로 다음 토큰(지번)만 탭 라벨로 쓴다. 앵커를 못 찾으면 기존 방식(마지막 토큰)으로 폴백.
const DONG_SUFFIX = /(동|읍|면|리|가)$/;

// extractLotLabel과 달리 검색어(query)에 기대지 않고 jibunAddress 문자열
// 자체에서 동 이름을 뽑는다 — "구"로 끝나는 토큰(있으면) 다음, 지번 숫자
// 토큰 앞까지 훑어 DONG_SUFFIX에 매칭되는 첫 토큰을 반환한다. 못 찾으면 null.
export const extractDongToken = (jibunAddress: string): string | null => {
  const tokens = jibunAddress.trim().split(/\s+/).filter(Boolean);
  const guIdx = tokens.findIndex((t) => t.endsWith("구"));
  const searchFrom = guIdx !== -1 ? guIdx + 1 : 0;
  for (let i = searchFrom; i < tokens.length; i++) {
    const token = tokens[i];
    if (/^-?\d/.test(token)) break; // 지번 숫자 토큰에 닿으면 중단
    if (DONG_SUFFIX.test(token)) return token;
  }
  return null;
};

// 검색어(query, jibunAddress 아님)에서 "시/도"+"구"(또는 구가 없으면 "시")
// 접두어만 뽑는다. DongPicker에서 동을 선택할 때 기존 검색어 뒤에 그냥
// 이어붙이면(구 문자열 concat) 검색어가 이미 특정 동/지번까지 포함한
// 상태에서 이 화면이 잘못 나타난 경우(예: 건물명이 "OO동"으로 끝나 동으로
// 오인식) "신흥동 신흥동"처럼 중복되거나 순서가 뒤바뀐 검색어가 만들어진다.
// 시/구 접두어만 남기고 그 뒤(기존 동/지번/건물명 등)는 버린 뒤 선택한
// 동을 새로 붙이면 이 문제가 원천적으로 사라진다.
export const administrativePrefixOf = (query: string): string => {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  const guIdx = tokens.findIndex((t) => t.endsWith("구"));
  if (guIdx !== -1) return tokens.slice(0, guIdx + 1).join(" ");
  const siIdx = tokens.findIndex((t) => t.endsWith("시"));
  if (siIdx !== -1) return tokens.slice(0, siIdx + 1).join(" ");
  return "";
};

// 후보 하나가 우연히 다른 동 이름을 물고 들어오면(백엔드 느슨한 매칭 —
// 실측: "창곡동" 검색이 진짜 창곡동 343건 + "성남시수정구 복정동
// 창곡동219-2호"처럼 실제 동은 복정동인데 "창곡동" 문자열을 포함해 매칭된
// 레코드 1건을 함께 반환) 그 1건짜리 잡음이 동 이름 버킷 하나를 만들어
// dongCounts.size가 2 이상이 되고, 이미 단일 동으로 좁혀진 검색인데도 동
// 선택 화면이 다시 뜬다. 더 나쁜 건 "창곡동"을 다시 선택해도 완전히 같은
// 쿼리라 같은 잡음이 또 섞여 들어와 무한 반복된다(2026-07-17 실측 재현).
// 후보 1건짜리 동은 통계적 잡음으로 보고 제외한다 — 실제로 여러 동에 걸친
// 검색("성남시 수정구")에서 관측된 진짜 동들은 전부 최소 38건 이상이라
// 이 임계값으로 걸러도 진짜 동이 잘못 지워질 위험은 낮다.
const MIN_DONG_CANDIDATE_COUNT = 2;

// search.tsx의 동 선택 게이트(candidates의 distinct 동 개수 판정)와 동 선택
// 버튼의 "N개" 표시가 같은 집계를 필요로 해서 한 번만 순회하도록 묶었다.
export function dongCandidateCounts(candidates: Candidate[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const c of candidates) {
    const dong = extractDongToken(c.jibunAddress);
    if (!dong) continue;
    counts.set(dong, (counts.get(dong) ?? 0) + 1);
  }
  for (const [dong, count] of counts) {
    if (count < MIN_DONG_CANDIDATE_COUNT) counts.delete(dong);
  }
  return counts;
}

// 실 데이터의 지번 토큰에 "번지" 같은 접미어가 섞여 있으면 탭 라벨이
// "123-4" / "56번지"처럼 표기가 들쭉날쭉해진다 — 숫자를 포함한 토큰에서만
// 후행 비숫자·비하이픈 문자를 잘라낸다(순수 텍스트 폴백 토큰은 건드리지 않음).
const stripLotSuffix = (token: string): string =>
  /\d/.test(token) ? token.replace(/[^\d-]+$/, "") : token;

export const extractLotLabel = (jibunAddress: string, query: string): string => {
  const tokens = jibunAddress.trim().split(/\s+/);
  const queryTokens = query.trim().split(/\s+/).filter(Boolean);
  const dongToken = queryTokens
    .slice()
    .reverse()
    .find((t) => DONG_SUFFIX.test(t));
  if (dongToken) {
    const idx = tokens.findIndex((t) => t === dongToken);
    if (idx !== -1 && idx + 1 < tokens.length) return stripLotSuffix(tokens[idx + 1]);
  }
  return tokens[tokens.length - 1] ?? jibunAddress;
};

// candidates 배열이 매 렌더마다(예: 검색창 타이핑으로 인한 SearchPage 리렌더) 새
// 참조로 만들어지면, 이 함수의 결과를 useMemo로 감싸지 않는 한 MapView의 마커
// 렌더 이펙트(`[mapReady, markers]` 의존)가 후보가 실제로 안 바뀌었는데도 매번
// 재실행된다(마커 전부 지웠다 다시 그리기 + fitBounds/setCenter 재계산). 순수
// 함수로 뽑아 호출부(search.tsx)에서 candidates/query/activePnu가 실제로 바뀔
// 때만 새 배열을 만들도록 useMemo에 넣어 쓴다.
//
// active 판정은 jibunAddress가 아니라 pnu로 한다 — 서로 다른 pnu가 우연히 같은
// jibunAddress 텍스트를 공유하는 실사례가 있다(2026-07-18 실측: 금토동 534-8,
// 일반 지번과 산 지번이 "산" 표기 없이 동일 텍스트로 내려옴 — 백엔드 이슈).
// jibunAddress로 비교하면 이 경우 두 마커가 동시에 active로 잡힌다.
export function buildSiteMarkers(
  candidates: Candidate[],
  query: string,
  activePnu: string | undefined,
): MapMarker[] {
  return candidates
    .filter((c) => c.latitude != null && c.longitude != null)
    .map((c) => ({
      id: c.pnu,
      lat: c.latitude as number,
      lng: c.longitude as number,
      label: extractLotLabel(c.jibunAddress, query),
      active: c.pnu === activePnu,
    }));
}
