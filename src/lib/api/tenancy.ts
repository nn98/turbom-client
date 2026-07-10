import type { Tenancy } from "./types";

// Pure helpers over Tenancy[] — apply identically whether the timeline came
// from the mock backend or a real one, so this does NOT live in
// legacy-adapter.ts (which is mock-data.ts-specific).

// 실 배포 백엔드는 영업/폐업/휴업 외에 인허가 원본 상태값을 그대로 흘려보낼 때가
// 있다(예: "취소/말소/만료/정지/중지", "제외/삭제/전출" — 2026-07-11 실측,
// 성남시 수정구 표본 1298건 중 5.2%). 영업·휴업이 아니면 전부 폐업과 동등하게
// 취급한다 — docs/spec/api-spec.md의 status enum과 실제 응답이 어긋나는
// 지점이며, 자세한 수치는 CLAUDE.md "알려진 스펙-실측 차이" 참고.
export const isOccupiedStatus = (status: Tenancy["status"]): boolean =>
  status === "영업" || status === "휴업";

// "이 자리를 지금 누가 쓰고 있는가" — 영업 중이거나 휴업 중인(=아직 폐업하지
// 않은) 이력을 찾는다. 완전히 폐업한(또는 폐업과 동등한) 이력만 종료된 것으로
// 취급한다.
export const findOccupant = (timeline: Tenancy[]): Tenancy | null =>
  timeline.find((t) => isOccupiedStatus(t.status)) ?? null;
