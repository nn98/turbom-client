import type { Tenancy } from "./types";

// Pure helpers over Tenancy[] — apply identically whether the timeline came
// from the mock backend or a real one, so this does NOT live in
// legacy-adapter.ts (which is mock-data.ts-specific).

// "이 자리를 지금 누가 쓰고 있는가" — 영업 중이거나 휴업 중인(=아직 폐업하지
// 않은) 이력을 찾는다. 완전히 폐업한 이력만 종료된 것으로 취급한다.
export const findOccupant = (timeline: Tenancy[]): Tenancy | null =>
  timeline.find((t) => t.status === "영업" || t.status === "휴업") ?? null;
