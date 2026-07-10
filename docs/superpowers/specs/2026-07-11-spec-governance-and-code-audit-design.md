# 터봄 클라이언트 — 스펙 거버넌스 규칙 + 코드 품질 감사 (설계)

날짜: 2026-07-11
대상 레포: `turbom-client` (이 레포, `nn98/turbom-client`)

## 배경

이 레포(프론트엔드)는 별도 레포 `nn98/turbom-server`의 `spec/` 문서를 기준으로 개발되어 왔지만, 그 사실이 이 레포 안 어디에도 못 박혀 있지 않았다. 코드 주석들이 `docs/backend-api.md`, `docs/report-api.md`라는 존재하지 않는 로컬 문서를 반복 참조하고 있었고, `README.md`는 실제 코드(`src/lib/api/` 레이어)와 다른, 더 오래된 아키텍처(Supabase Edge Function 스타일)를 설명하고 있었다.

이 설계는 두 가지를 다룬다:

1. **규칙 확정**: 이 클라이언트 레포가 지켜야 할 스펙의 범위, 로컬 미러링 방식, 스펙-코드 어긋남 발생 시 처리 원칙, 그리고 스펙 변경을 협업자에게 자동으로 전파하는 방법.
2. **코드 품질 감사**: 위 규칙을 세우는 과정에서 실제 코드와 실제 배포 백엔드(`https://turbom.duckdns.org`) 응답을 검증해 찾아낸 구체적 문제들의 우선순위 backlog.

## 범위 밖

- `turbom-server`의 `backend-spec.md`, `schema.sql`, 인허가/상가API 파이프라인 문서 — 서버 레포 소관, 이 레포는 참조하지 않는다.
- 백엔드 쪽 수정(예: `Tenancy.status` 정규화) — 이 설계는 클라이언트 쪽 대응만 다룬다. 백엔드 정규화 여부는 서버 팀 판단.

---

## 섹션 A — 규칙 문서: 신규 `CLAUDE.md`

이 레포 루트에 `CLAUDE.md`를 신규 생성한다(기존 `AGENTS.md`는 Lovable 전용 공지만 있고 규칙이 없어 그대로 둔다 — 둘의 역할이 명확히 분리됨).

내용:

1. **스펙 소스 한정**: `nn98/turbom-server`의 `spec/api-spec.md`(프론트-백 연동 계약)와 `spec/frontend-spec.md`(프론트 단독 명세)만 이 레포의 규범 문서. 그 외 서버 전용 스펙은 신경 쓰지 않는다.
2. **로컬 미러 경로**: `docs/spec/api-spec.md`, `docs/spec/frontend-spec.md` — 원본 파일명 그대로, 원본과 바이트 단위로 동일하게 유지(디핑을 단순하게 하기 위해 로컬에서 직접 수정하지 않는다). 코드 주석의 유령 경로(`docs/backend-api.md`, `docs/report-api.md`)는 전부 이 경로로 정정한다.
3. **정합성 원칙**: 현재 정상 동작하는 코드가 기준선이다. 스펙과 코드가 어긋나면 기계적으로 "코드를 스펙에 맞춘다"가 아니라, 실제 배포 백엔드 응답을 확인한 뒤 케이스별로 어느 쪽을 갱신할지 판단한다. 스펙 문서 자체(미러 사본)는 원본 그대로 두고, 알려진 차이는 `CLAUDE.md`의 "알려진 스펙-실측 차이" 절에 기록한다(섹션 C의 `Tenancy.status` 건이 그 첫 사례).
4. **드리프트 감지**: 섹션 B의 GitHub Actions 워크플로우를 문서화.

## 섹션 B — 스펙 드리프트 자동 감지 (GitHub Actions)

`.github/workflows/spec-drift-check.yml` 신규 생성.

- **트리거**: 매일 1회 스케줄(cron) + 수동 실행(`workflow_dispatch`)
- **동작**:
  1. `raw.githubusercontent.com/nn98/turbom-server/main/spec/api-spec.md`와 `frontend-spec.md`를 가져온다.
  2. 레포에 커밋된 `docs/spec/api-spec.md` / `docs/spec/frontend-spec.md`와 내용을 비교한다.
  3. 다르면: `spec-drift` 라벨의 이슈를 생성한다. 단, 같은 라벨의 열린 이슈가 이미 있으면 새로 만들지 않고 그 이슈에 코멘트만 추가한다(중복 방지). 이슈 본문에는 어떤 파일이 바뀌었는지와 diff 요약을 포함한다.
- **권한**: 같은 레포에 이슈만 쓰면 되므로 기본 `GITHUB_TOKEN`(`issues: write`)으로 충분하다. `turbom-server` 쪽 접근 권한은 불필요(공개 raw 파일 GET만 수행).
- **비용**: GitHub Actions만 사용하고 어떤 LLM/외부 유료 API도 호출하지 않는다 — 토큰 소모 없음.

## 섹션 C — 코드 품질 감사 Backlog (우선순위순)

### 1. `Tenancy.status` 스펙-실측 불일치 (최우선, 실측 확인됨)

`api-spec.md`/`types.ts`는 `Tenancy.status`를 `"영업" | "폐업" | "휴업"` 3단계로 선언하지만, 실 배포 백엔드(`turbom.duckdns.org`)를 성남시 수정구 12개 동·515개 물건·1298개 이력 샘플로 검증한 결과 스펙에 없는 값이 실제로 내려온다:

| status 값 | 건수 | 비율 |
|---|---|---|
| 폐업 | 658 | 50.7% |
| 영업 | 570 | 43.9% |
| 취소/말소/만료/정지/중지 | 39 | 3.0% |
| 제외/삭제/전출 | 29 | 2.2% |
| 휴업 | 2 | 0.2% |

스펙에 없는 두 값이 전체의 **5.2%**를 차지한다. 인허가 원본의 상태/사유 코드가 정규화 없이 그대로 내려오는 것으로 보인다.

**합의된 처리 원칙**: `영업`과 `휴업`을 제외한 모든 값은 "폐업과 동등"하게 취급한다(사용자 확인 완료 — 취소/말소/만료/정지/중지/제외/삭제/전출은 전부 "더 이상 그 자리에서 정식으로 영업 중이 아님"을 뜻하므로 폐업과 같은 의미 버킷).

**조치**:
- `src/lib/api/tenancy.ts`에 헬퍼 추가: `isOccupiedStatus(status) = status === "영업" || status === "휴업"`, 그리고 그 부정을 "폐업 등가"로 사용.
- `findOccupant()`는 이미 이 로직과 동일하게 동작 중(`.find(t => 영업 || 휴업)`)이므로 변경 불필요 — 헬퍼로 표현만 통일.
- `src/routes/report.$storeId.tsx`의 `sameSubCategoryFailures` 계산(현재 `t.status === "폐업"`로 직접 비교)을 위 헬퍼의 부정(`!isOccupiedStatus(t.status)`)으로 교체 — 현재 스펙 외 값들이 "실패 횟수"에서 누락되는 걸 바로잡는다.
- `src/lib/api/types.ts`의 `Tenancy.status` 타입을 `"영업" | "휴업" | (string & {})`로 넓힌다 — 두 확정값은 자동완성을 유지하면서, 실제로 관측되는 임의의 문자열도 타입 에러 없이 받는다.
- `CLAUDE.md`의 "알려진 스펙-실측 차이" 절에 위 표와 조치를 기록한다(로컬 스펙 미러 파일 자체는 원본 그대로 유지).

### 2. `.gitattributes` 부재로 인한 lint 무력화

Windows에서 `core.autocrlf=true`(로컬 확인됨)면 전체 파일이 CRLF로 체크아웃되고, prettier가 LF 기준이라 `bun run lint` 실행 시 실제로 **7505개의 가짜 에러**가 발생해 진짜 경고 6개(shadcn 보일러플레이트, 안 고쳐도 됨)가 완전히 묻힌다. `.gitattributes`에 `* text=auto eol=lf`를 추가하고 1회 전체 재정규화한다.

### 3. `README.md`가 실제 아키텍처와 불일치

`src/lib/mock-data.ts`만 데이터 계층으로 설명하고, 실제로 존재하는 `src/lib/api/`(mock-client/real-client/legacy-adapter/unit-analysis/tenancy) 레이어와 `VITE_API_BASE_URL`을 통한 목/실 전환 방식을 전혀 언급하지 않는다. "Edge Function"(Supabase 스타일) 서술도 실제 구현(TanStack Start SSR, 순수 클라이언트 서비스 레이어)과 다르다. 실제 구조에 맞게 재작성한다.

### 4. 유령 문서 경로 정리

코드 주석이 `docs/backend-api.md`(다수 파일)와 `docs/report-api.md`(unit-analysis.ts 1곳)를 섞어서 가리키는데 둘 다 실존하지 않는다. 섹션 A에서 만드는 `docs/spec/api-spec.md`로 전부 통일한다.

### 5. `<html lang="en">`

`src/routes/__root.tsx`의 루트 `<html>` 태그가 `lang="en"`으로 되어 있으나 전체 콘텐츠가 한국어다. `lang="ko"`로 수정 — 접근성/SEO에 실질적 영향.

### 6. `report.$storeId.tsx` 831줄 — 파일 분할 (재량)

프레젠테이션 서브컴포넌트 10개가 한 파일에 몰려 있다. 최근 커밋 이력(`통계 표시 방식 개선` 등)이 반복적으로 이 파일을 건드리고 있어, 계속 손볼 계획이면 `src/components/report/*.tsx`로 분리하는 편이 유지보수에 유리하다. 급하지 않음 — 팀 판단.

### 7. 테스트 전무 (재량)

`vitest`/`jest` 등 테스트 러너가 없다. `tsc --noEmit`은 통과하고 실질적 eslint 경고도 6개뿐이라 시급하지는 않지만, `unit-analysis.ts`/`tenancy.ts`/`mock-client.ts`의 순수 함수들은 최근 반복 회귀가 있었던 지점이라(통계 표시 관련 커밋 다수) 최소 유닛 테스트를 붙일 가치가 있다. 항목 1의 `isOccupiedStatus` 헬퍼는 정확히 이런 값싼 유닛 테스트감이다.

---

## 에러 처리 / 검증 방식

- 항목 1(`Tenancy.status`)의 조치는 실제 배포 백엔드에 대한 curl 기반 실측으로 이미 검증됨(위 표). 구현 후에는 동일한 방식으로 재검증 가능(같은 유닛 ID들로 `sameSubCategoryFailures` 값이 바뀌는지 확인).
- GitHub Actions 워크플로우는 `docs/spec/` 파일 내용을 의도적으로 한 글자 수정한 뒤 워크플로우를 수동 실행(`workflow_dispatch`)해 이슈가 실제로 생성되는지로 검증한다.
- `.gitattributes` 추가 후 `bun run lint`를 재실행해 에러 수가 6개(경고)로 줄어드는지 확인한다.

## 테스트

- 항목 1: `isOccupiedStatus`에 대한 최소 단위 테스트(항목 7과 함께, 테스트 러너 도입이 선행 조건이면 그 부분부터).
- 나머지 항목은 대부분 문서/설정/타입 변경이라 별도 테스트 불필요 — `tsc --noEmit`과 `bun run lint`(gitattributes 수정 후) 통과로 충분.
