import type { Tenancy } from "@/lib/api";
import { namesLikelySame } from "./business-name";

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
