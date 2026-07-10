# CLAUDE.md — 터봄(Turbohm) 클라이언트 레포 규칙

이 레포(`turbom-client`, 프론트엔드)가 지켜야 할 스펙 범위와 정합성 규칙을 못박는 문서.

## 1. 스펙 소스

이 레포는 `github.com/nn98/turbom-server`의 `spec/` 문서 중 다음 두 개만 규범으로 삼는다:

- `spec/api-spec.md` — 프론트-백 연동 계약(요청/응답 스키마)
- `spec/frontend-spec.md` — 프론트 단독 명세

그 외(`backend-spec.md`, `schema.sql`, 인허가/상가API 파이프라인 문서 등)는 서버 레포 소관이며 이 레포는 참조하지 않는다.

## 2. 로컬 미러

위 두 파일은 `docs/spec/api-spec.md`, `docs/spec/frontend-spec.md`로 로컬에 동기화되어 있다 — 원본 파일명 그대로, 내용은 원본과 바이트 단위로 동일하게 유지한다(로컬에서 직접 수정하지 않는다). 코드 주석에서 이 계약을 가리킬 땐 반드시 `docs/spec/api-spec.md` 경로를 쓴다.

## 3. 정합성 원칙

현재 정상 동작하는 코드가 기준선이다. 스펙과 코드가 어긋나면:

1. 실제 배포 백엔드(`https://turbom.duckdns.org`, `.env.local`의 `VITE_API_BASE_URL`)를 호출해 실제 응답을 확인한다.
2. 케이스별로 어느 쪽을 갱신할지 판단한다 — "무조건 코드를 스펙에 맞춘다"가 원칙이 아니다.
3. 미러 사본(`docs/spec/*.md`)은 원본 그대로 두고, 코드가 스펙보다 실측을 우선한 경우 아래 "알려진 스펙-실측 차이"에 기록한다.

## 4. 스펙 드리프트 자동 감지

`.github/workflows/spec-drift-check.yml`이 매일 1회(+수동 실행)로 `turbom-server`의 `spec/api-spec.md`, `spec/frontend-spec.md`를 로컬 미러와 비교한다. 다르면 `spec-drift` 라벨의 이슈를 새로 열거나(이미 열려있으면 코멘트로) 갱신한다. GitHub Actions만 쓰고 외부 유료/LLM API 호출은 없다.

## 5. 알려진 스펙-실측 차이

### `Tenancy.status`

`api-spec.md`는 `"영업" | "폐업" | "휴업"` 3값만 선언하지만, 실 배포 백엔드는 인허가 원본 상태값을 정규화 없이 그대로 내려줄 때가 있다. 2026-07-11, 성남시 수정구 12개 동·515개 물건·1298개 이력 샘플 실측:

| status 값                | 건수 | 비율  |
| ------------------------ | ---- | ----- |
| 폐업                     | 658  | 50.7% |
| 영업                     | 570  | 43.9% |
| 취소/말소/만료/정지/중지 | 39   | 3.0%  |
| 제외/삭제/전출           | 29   | 2.2%  |
| 휴업                     | 2    | 0.2%  |

**처리**: `영업`/`휴업`이 아니면 전부 "폐업과 동등"하게 취급한다. `src/lib/api/tenancy.ts`의 `isOccupiedStatus()`가 이 판정의 유일한 창구이며, `Tenancy.status`의 타입은 `"영업" | "휴업" | (string & {})`로 넓혀 실제 응답과 타입이 어긋나지 않게 했다(`src/lib/api/types.ts`).
