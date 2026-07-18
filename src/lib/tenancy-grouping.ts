import type { Tenancy } from "@/lib/api";

// 공백·괄호(및 그 안의 내용)·가운뎃점·하이픈 차이는 무시하고 비교하기
// 위한 정규화. 괄호는 안의 내용까지 통째로 지운다 — 실측(2026-07-18,
// 4113111600107130000-U3): "씨유(CU) 판교이노베이션랩점"과 "씨유
// 판교이노베이션랩점"은 같은 편의점이 안전상비의약품 판매업/휴게음식점
// 두 인허가를 동시에 낸 것뿐인데, 괄호 문자만 지우고 안의 "CU"는 남기면
// 두 문자열이 끝내 안 같아진다 — 괄호+내용째로 제거해야 맞는다.
const normalizeBusinessName = (name: string): string =>
  name
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/[\s·.\-㈜]/g, "")
    .toLowerCase();

// 정확히 같거나, 한쪽이 다른 쪽을 통째로 포함하면 같은 상호로 본다.
// 포함 방향을 접두어(지점명이 뒤에 붙는 경우, 예: "스타벅스"/"스타벅스
// 강남점")로만 제한하지 않는다 — 실측(2026-07-18, 4113111600107170000-U1):
// "(주)놀유니버스 구내식당"(시설 소유주 자체 등록)과 "풀무원푸드앤컬처
// 놀유니버스 구내식당"(위탁급식업체가 운영사명을 앞에 붙여 등록)은 같은
// 구내식당인데 공통 부분("놀유니버스구내식당")이 뒤쪽 문자열의 접두어가
// 아니라 접미어라 접두어만 검사하면 놓친다. 짧은 쪽 길이 3 미만은 오탐
// 위험이 커 제외.
const namesLikelySame = (a: string, b: string): boolean => {
  const na = normalizeBusinessName(a);
  const nb = normalizeBusinessName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const [shorter, longer] = na.length <= nb.length ? [na, nb] : [nb, na];
  return shorter.length >= 3 && longer.includes(shorter);
};

// 같은 물건(unit) 안에서 서로 다른 인허가 레코드로 쪼개졌지만 실제로는
// 하나의 영업으로 보이는 경우(기간이 겹치고 상호명도 사실상 같음)를
// "그룹"으로만 묶는다. 막대 자체는 합치지 않는다 — 각 레코드의 실제 기간을
// 그대로 보여줘야 하므로, 호출부(간트차트)가 그룹에 속한 행에만 배경
// 강조를 입혀 시각적으로만 연결해 보여준다. 반환값은 tenancyId → 그룹 번호
// 맵이며, 그룹 크기가 1인(묶일 상대가 없는) 레코드는 맵에 포함하지 않는다.
export const groupSimilarOverlappingTenancies = (
  timeline: Tenancy[],
  now: string,
): Map<string, number> => {
  const sorted = [...timeline].sort((a, b) => a.licensedAt.localeCompare(b.licensedAt));
  const groups: Tenancy[][] = [];
  for (const t of sorted) {
    const tEnd = t.closedAt ?? now;
    const group = groups.find((g) =>
      g.some((existing) => {
        const existingEnd = existing.closedAt ?? now;
        return (
          namesLikelySame(existing.businessName, t.businessName) &&
          existing.licensedAt <= tEnd &&
          t.licensedAt <= existingEnd
        );
      }),
    );
    if (group) group.push(t);
    else groups.push([t]);
  }
  const groupIdOf = new Map<string, number>();
  groups.forEach((g, i) => {
    if (g.length > 1) {
      for (const t of g) groupIdOf.set(t.tenancyId, i);
    }
  });
  return groupIdOf;
};
