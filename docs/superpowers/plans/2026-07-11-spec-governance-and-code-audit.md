# 스펙 거버넌스 규칙 + 코드 품질 감사 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** turbom-client 레포에 스펙 거버넌스 규칙(CLAUDE.md + 로컬 스펙 미러 + 자동 드리프트 감지)을 못박고, 실 배포 백엔드 검증으로 확인한 코드 품질 문제들(라인엔딩, 유령 문서 경로, README 불일치, a11y, `Tenancy.status` 스펙 불일치)을 고친다.

**Architecture:** 문서/설정 변경(`.gitattributes`, `CLAUDE.md`, `docs/spec/`, GitHub Actions 워크플로우)과 코드 변경(`src/lib/api/tenancy.ts`의 `isOccupiedStatus` 헬퍼 + 그 소비처)을 분리된 태스크로 진행한다. 각 태스크는 독립적으로 커밋 가능하다.

**Tech Stack:** React 19 + TanStack Start + TypeScript, Vitest(신규 도입, 순수 로직 모듈 테스트용), GitHub Actions.

## Global Constraints

- 스펙 소스는 `nn98/turbom-server`의 `spec/api-spec.md`, `spec/frontend-spec.md`만 규범으로 삼는다. `backend-spec.md`/`schema.sql`/파이프라인 문서는 참조하지 않는다.
- 로컬 미러 경로는 `docs/spec/api-spec.md`, `docs/spec/frontend-spec.md`로 고정 — 원본 파일명 그대로, 원본과 바이트 단위로 동일하게 유지(로컬에서 직접 수정하지 않는다).
- 스펙 드리프트 감지는 GitHub Actions만 사용한다 — 어떤 LLM/외부 유료 API도 호출하지 않는다.
- `Tenancy.status`가 `"영업"`/`"휴업"`이 아니면 전부 "폐업과 동등"하게 취급한다(사용자 확정 사항).
- 기존 코드 관례를 따른다: `src/lib/api/*` 내부는 상대 경로 import, 라우트/컴포넌트는 `@/lib/api`(배럴)만 import, 주석은 "왜"를 한국어로 설명하는 기존 스타일 유지.

---

### Task 1: 라인엔딩 위생 (`.gitattributes`)

**Files:**

- Create: `.gitattributes`
- Modify: 전체 추적 파일(`git add --renormalize .`로 자동 처리, 개별 나열 불필요)

**Interfaces:** 없음(순수 설정/포맷 변경, 다른 태스크가 이 파일의 심볼을 소비하지 않음).

이 레포는 Windows에서 `core.autocrlf=true`면 전체 파일이 CRLF로 체크아웃되고, prettier가 LF 기준이라 `bun run lint`가 실제 경고 6개를 가짜 에러 7505개 밑에 묻어버린다. 먼저 이 태스크와 무관한 기존 작업 중인 변경사항을 건드리지 않도록 스태시로 치워둔다.

- [ ] **Step 1: 기존 미커밋 변경사항 확인 및 스태시**

Run: `git status --short`

이 시점에 `.gitignore`, `package-lock.json`, `src/routeTree.gen.ts` 등 이 플랜과 무관한 수정이 남아있다면(작업 시작 시점 기준), 렌더멀라이즈 커밋에 섞이지 않도록 치워둔다:

```bash
git stash push -u -m "wip: pre-existing changes unrelated to spec-governance work"
```

변경사항이 전혀 없다면(=이미 깨끗하다면) 이 스텝은 건너뛴다.

- [ ] **Step 2: `.gitattributes` 작성**

```
* text=auto eol=lf
```

- [ ] **Step 3: 전체 재정규화**

Run: `git add --renormalize .`

Expected: `git status --short`에 다수 파일이 `M `(staged modified)로 표시됨 — 내용이 아니라 줄바꿈만 바뀐 것이므로 정상.

- [ ] **Step 4: lint로 검증**

Run: `bun run lint`

Expected: 에러 0개, 경고 6개(shadcn `ui/` 폴더의 `react-refresh/only-export-components`, 기존부터 있던 것 — 고치지 않는다).

- [ ] **Step 5: 커밋**

```bash
git add .gitattributes
git commit -m "$(cat <<'EOF'
chore: 라인엔딩을 LF로 고정하고 전체 재정규화

Windows(core.autocrlf=true) 체크아웃에서 prettier/eslint가 매 줄을
CRLF 에러로 잡아 실제 경고 6개가 가짜 에러 7505개에 묻히던 문제 해결.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 6: 치워둔 기존 변경사항 복원(Step 1에서 스태시했을 경우만)**

```bash
git stash pop
```

Expected: 충돌 없이 복원. 만약 줄바꿈 차이로 충돌이 나면, 스태시 쪽(기존 작업 내용)을 우선하고 해당 파일만 수동으로 다시 저장한다.

---

### Task 2: 스펙 로컬 미러링 (`docs/spec/`)

**Files:**

- Create: `docs/spec/api-spec.md`
- Create: `docs/spec/frontend-spec.md`

**Interfaces:**

- Produces: `docs/spec/api-spec.md`, `docs/spec/frontend-spec.md` — Task 3(CLAUDE.md)과 Task 4(GitHub Actions)가 이 정확한 경로를 참조한다.

두 파일 모두 `nn98/turbom-server`의 `main` 브랜치 `spec/` 아래에 이미 존재함을 확인했다(2026-07-11, 둘 다 raw.githubusercontent.com에서 200 응답).

- [ ] **Step 1: 디렉토리 생성 및 원본 다운로드**

```bash
mkdir -p docs/spec
curl -fsSL "https://raw.githubusercontent.com/nn98/turbom-server/main/spec/api-spec.md" -o docs/spec/api-spec.md
curl -fsSL "https://raw.githubusercontent.com/nn98/turbom-server/main/spec/frontend-spec.md" -o docs/spec/frontend-spec.md
```

- [ ] **Step 2: 다운로드 검증**

Run: `wc -l docs/spec/api-spec.md docs/spec/frontend-spec.md`

Expected: 둘 다 0줄이 아닌, 실제 내용이 있는 파일(빈 파일이면 curl이 실패했다는 뜻 — URL과 네트워크 확인).

- [ ] **Step 3: 커밋**

```bash
git add docs/spec/api-spec.md docs/spec/frontend-spec.md
git commit -m "$(cat <<'EOF'
docs: turbom-server spec 로컬 미러 추가

api-spec.md/frontend-spec.md를 원본 그대로 docs/spec/에 동기화.
CLAUDE.md의 스펙 거버넌스 규칙이 참조하는 경로.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `CLAUDE.md` 거버넌스 문서

**Files:**

- Create: `CLAUDE.md`

**Interfaces:**

- Consumes: Task 2가 만든 `docs/spec/api-spec.md`, `docs/spec/frontend-spec.md` 경로(파일 내용에서 경로만 참조, 실행 의존성 없음).
- Consumes: Task 7에서 확정되는 `isOccupiedStatus`(파일 내 "알려진 스펙-실측 차이" 절에서 함수명을 언급 — Task 7과 명칭이 어긋나면 안 됨).

- [ ] **Step 1: `CLAUDE.md` 작성**

```markdown
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
```

- [ ] **Step 2: 커밋**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: 클라이언트 레포 스펙 거버넌스 규칙(CLAUDE.md) 추가

스펙 소스 범위, 로컬 미러 경로, 정합성 원칙, 알려진 스펙-실측 차이를 못박음.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: 스펙 드리프트 GitHub Actions 워크플로우

**Files:**

- Create: `.github/workflows/spec-drift-check.yml`

**Interfaces:**

- Consumes: Task 2의 `docs/spec/api-spec.md`, `docs/spec/frontend-spec.md`(비교 대상).

- [ ] **Step 1: 워크플로우 작성**

````yaml
name: Spec Drift Check

on:
  schedule:
    - cron: "0 0 * * *"
  workflow_dispatch: {}

jobs:
  check-drift:
    runs-on: ubuntu-latest
    permissions:
      issues: write
    steps:
      - uses: actions/checkout@v4

      - name: Compare local spec mirror against turbom-server
        id: diff
        run: |
          set -e
          UPSTREAM="https://raw.githubusercontent.com/nn98/turbom-server/main/spec"
          BODY_FILE="$(mktemp)"
          DRIFT=0
          for f in api-spec.md frontend-spec.md; do
            curl -fsSL "$UPSTREAM/$f" -o "/tmp/$f.upstream"
            if ! diff -u "docs/spec/$f" "/tmp/$f.upstream" > "/tmp/$f.diff"; then
              DRIFT=1
              {
                echo "### \`$f\` changed upstream"
                echo '```diff'
                head -c 4000 "/tmp/$f.diff"
                echo '```'
              } >> "$BODY_FILE"
            fi
          done
          echo "drift=$DRIFT" >> "$GITHUB_OUTPUT"
          cp "$BODY_FILE" /tmp/issue-body.md

      - name: Ensure spec-drift label exists
        if: steps.diff.outputs.drift == '1'
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          gh label create spec-drift --repo "${{ github.repository }}" \
            --color FBCA04 --description "turbom-server spec 미러와 실제 내용이 어긋남" || true

      - name: Open or update drift issue
        if: steps.diff.outputs.drift == '1'
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          set -e
          EXISTING=$(gh issue list --repo "${{ github.repository }}" --label spec-drift --state open --json number --jq '.[0].number')
          if [ -n "$EXISTING" ]; then
            gh issue comment "$EXISTING" --repo "${{ github.repository }}" --body-file /tmp/issue-body.md
          else
            gh issue create --repo "${{ github.repository }}" \
              --title "turbom-server spec 변경 감지됨" \
              --label spec-drift \
              --body-file /tmp/issue-body.md
          fi
````

- [ ] **Step 2: YAML 문법 검증**

Run: `npx -y yaml-lint .github/workflows/spec-drift-check.yml 2>&1 || python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/spec-drift-check.yml'))"`

Expected: 에러 없이 종료(둘 중 하나만 실행 가능하면 됨 — YAML 파싱만 확인하는 용도).

- [ ] **Step 3: 수동 실행으로 실제 동작 검증(GitHub에 푸시된 뒤)**

Run: `gh workflow run "Spec Drift Check"` (푸시 이후, GitHub CLI 인증 필요)

Expected: 현재는 `docs/spec/*.md`가 원본과 동일하므로 이슈가 생성되지 않음(`drift=0`). 드리프트 감지 자체를 확인하려면 `docs/spec/api-spec.md`를 한 글자 임시로 고친 뒤 실행 → 이슈 생성 확인 → 되돌리기.

- [ ] **Step 4: 커밋**

```bash
git add .github/workflows/spec-drift-check.yml
git commit -m "$(cat <<'EOF'
ci: turbom-server 스펙 드리프트 자동 감지 워크플로우 추가

매일 1회 + 수동 실행으로 로컬 스펙 미러와 원본을 비교, 어긋나면
spec-drift 라벨 이슈를 생성/갱신. GitHub Actions만 사용, 외부 유료
API 호출 없음.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: 유령 문서 경로 + `lang` 속성 수정

**Files:**

- Modify: `.env.example:4`
- Modify: `src/lib/mock-data.ts:12`
- Modify: `src/lib/api/client.ts:6`
- Modify: `src/lib/api/types.ts:1`
- Modify: `src/lib/api/unit-analysis.ts:6,18`
- Modify: `src/lib/api/legacy-adapter.ts:5,11,16`
- Modify: `src/routes/report.$storeId.tsx:482`
- Modify: `src/routes/__root.tsx:111`

**Interfaces:** 없음(주석/속성 텍스트만 변경, 실행 동작에 영향 없음).

`docs/backend-api.md`, `docs/report-api.md`라는 존재하지 않던 경로를 Task 2에서 만든 `docs/spec/api-spec.md`로 통일하고, 루트 `<html lang="en">`을 실제 언어(한국어)로 고친다.

- [ ] **Step 1: `.env.example`**

```diff
-# using the contract in docs/backend-api.md.
+# using the contract in docs/spec/api-spec.md.
```

- [ ] **Step 2: `src/lib/mock-data.ts`**

```diff
-  // 영업/폐업/휴업 3단계 (docs/backend-api.md의 Tenancy.status와 동일).
+  // 영업/폐업/휴업 3단계 (docs/spec/api-spec.md의 Tenancy.status와 동일).
```

- [ ] **Step 3: `src/lib/api/client.ts`**

```diff
-// docs/backend-api.md "목/실 전환"). Unset = demo mode, backed by the
+// docs/spec/api-spec.md "목/실 전환"). Unset = demo mode, backed by the
```

- [ ] **Step 4: `src/lib/api/types.ts`**

```diff
-// Response contract mirrored from docs/backend-api.md.
+// Response contract mirrored from docs/spec/api-spec.md.
```

- [ ] **Step 5: `src/lib/api/unit-analysis.ts`(두 곳)**

```diff
-// docs/backend-api.md's response contract (SearchResponse/SiteDetail/
+// docs/spec/api-spec.md's response contract (SearchResponse/SiteDetail/
```

```diff
-// current occupant to read marketInfo from). Per docs/report-api.md's
+// current occupant to read marketInfo from). Per docs/spec/api-spec.md's
```

- [ ] **Step 6: `src/lib/api/legacy-adapter.ts`(세 곳)**

```diff
-// docs/backend-api.md response shape, WITHOUT introducing a second/parallel
+// docs/spec/api-spec.md response shape, WITHOUT introducing a second/parallel
```

```diff
-// docs/backend-api.md):
+// docs/spec/api-spec.md):
```

```diff
-//   docs/backend-api.md's "항상 목업(isPlaceholder: true)" contract.
+//   docs/spec/api-spec.md's "항상 목업(isPlaceholder: true)" contract.
```

- [ ] **Step 7: `src/routes/report.$storeId.tsx`**

```diff
-// docs/backend-api.md "③ 물건 상세" 화면 규격: 타임라인(가로 바) + tenancyId
+// docs/spec/api-spec.md "③ 물건 상세" 화면 규격: 타임라인(가로 바) + tenancyId
```

- [ ] **Step 8: `src/routes/__root.tsx`**

```diff
-    <html lang="en">
+    <html lang="ko">
```

- [ ] **Step 9: 유령 경로가 남아있지 않은지 검증**

Run: `grep -rn "docs/backend-api.md\|docs/report-api.md" src .env.example`

Expected: 매칭 없음(exit code 1).

- [ ] **Step 10: 타입체크**

Run: `npx tsc --noEmit`

Expected: 에러 없음(주석/속성만 바꿨으므로 그대로 통과해야 함).

- [ ] **Step 11: 커밋**

```bash
git add .env.example src/lib/mock-data.ts src/lib/api/client.ts src/lib/api/types.ts \
  src/lib/api/unit-analysis.ts src/lib/api/legacy-adapter.ts src/routes/report.\$storeId.tsx \
  src/routes/__root.tsx
git commit -m "$(cat <<'EOF'
docs: 유령 문서 경로 정리 + html lang 속성 수정

존재하지 않던 docs/backend-api.md, docs/report-api.md 참조를 실제
경로(docs/spec/api-spec.md)로 통일. 전체가 한국어 콘텐츠인데
lang="en"으로 되어 있던 루트 html 태그도 lang="ko"로 수정.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `README.md` 아키텍처 서술 갱신

**Files:**

- Modify: `README.md` (5번 "폴더 구조", 6번 "데이터 설계 개요" 절)

**Interfaces:** 없음(문서 전용).

현재 README의 5·6번 절은 `src/lib/mock-data.ts`만 있던 시절의 구조를 설명하고, 실제로 존재하는 `src/lib/api/` 레이어와 Supabase 스타일이 아닌 실제 목/실 전환 방식을 반영하지 못한다.

- [ ] **Step 1: 5·6번 절 교체**

`## 5. 폴더 구조 (Directory Structure)`부터 `## 6. 데이터 설계 개요 (Domain Model)` 절 끝(`## 7. 사용자 흐름` 직전)까지를 아래로 교체한다:

```markdown
## 5. 폴더 구조 (Directory Structure)
```

src/
├── routes/
│ ├── __root.tsx # 루트 레이아웃 + 메타
│ ├── index.tsx # 랜딩
│ ├── search.tsx # 검색
│ └── report.$storeId.tsx # 리포트
├── components/
│ ├── site-header.tsx
│ ├── site-footer.tsx
│ ├── map-view.tsx # 네이버 지도 wrapper (VITE_NAVER_MAP_CLIENT_ID 필요)
│ └── ui/ # shadcn/ui
├── hooks/
│ └── use-sites.ts # TanStack Query 훅 (useSiteSearch/useSiteDetail/useUnitDetail)
├── lib/
│ ├── api/ # 백엔드 계약 레이어 — routes/hooks는 이 폴더만 import한다
│ │ ├── types.ts # docs/spec/api-spec.md를 그대로 미러링한 응답 타입
│ │ ├── client.ts # VITE_API_BASE_URL 유무로 mock/real 전환하는 공개 엔트리포인트
│ │ ├── real-client.ts # 실 백엔드 fetch 구현
│ │ ├── mock-client.ts # mock-data.ts를 API 계약 모양으로 변환해 서빙
│ │ ├── legacy-adapter.ts # mock-data.ts(Store/StoreHistory) → api 타입(Tenancy 등) 변환
│ │ ├── tenancy.ts # Tenancy[] 순수 헬퍼(findOccupant, isOccupiedStatus)
│ │ ├── unit-analysis.ts # 백엔드 계약에 없는 프론트 전용 분석(riskLevel/narrative/체크리스트)
│ │ ├── errors.ts # ApiRequestError + 에러 코드별 생성 함수
│ │ └── index.ts # 공개 re-export (routes/hooks는 "@/lib/api"만 import)
│ ├── mock-data.ts # 데모 모드 원본 데이터셋(legacy-adapter.ts가 소비)
│ └── utils.ts
└── styles.css # Design tokens (Navy · White · Green)

````

## 6. 데이터 설계 개요 (Domain Model)

프론트엔드는 `src/lib/api/types.ts`의 타입을 기준으로 동작한다. 이 타입은 `docs/spec/api-spec.md`(터봄 서버 레포의 계약)를 그대로 미러링한 것이며, 로컬 사본과 원본이 어긋나면 `.github/workflows/spec-drift-check.yml`이 이슈로 알려준다 — 자세한 규칙은 레포 루트의 `CLAUDE.md` 참고.

```ts
SearchResponse { candidates: Candidate[] }
Candidate { pnu, jibunAddress, roadAddress, latitude, longitude, unitCount, closedCount }

SiteDetail { site, units: UnitSummary[], disclaimer }
UnitSummary { unitId, label, currentBusinessName, currentStatus: "영업"|"공실", ... }

UnitDetail { unit, statistics, timeline: Tenancy[], disclaimer }
Tenancy { tenancyId, businessName, category, subCategory, status, marketInfo, ... }
````

**목/실 전환**: `VITE_API_BASE_URL` 미설정 = 데모 모드(`mock-client.ts`가 `mock-data.ts`를 계약 모양으로 변환해 서빙). 설정 시 `real-client.ts`가 그 값으로 실 백엔드를 호출한다 — 어느 쪽이든 라우트/컴포넌트 코드는 `src/lib/api`의 동일한 타입만 본다(`client.ts` 참고).

**그레이존 분석**: 위험도(riskLevel)·종합 분석(narrative)·상권 구성(district)·체크리스트는 백엔드 계약(`UnitDetail`)에 없는 값이다. `src/lib/api/unit-analysis.ts`가 `UnitDetail`을 받아 프론트엔드에서만 계산하며, 실측 가능한 필드(`marketInfo.categoryBreakdown` 등)가 있으면 그걸 쓰고 없으면 데모용 고정값으로 폴백한다.

````

- [ ] **Step 2: 커밋**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs: README 아키텍처 서술을 실제 코드에 맞게 갱신

mock-data.ts만 있던 시절 서술을 실제 src/lib/api/ 레이어(목/실 전환,
그레이존 분석 위치)로 교체.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
````

---

### Task 7: `Tenancy.status` 정규화 (Vitest 도입 + `isOccupiedStatus`)

**Files:**

- Create: `vitest.config.ts`
- Create: `src/lib/api/tenancy.test.ts`
- Modify: `package.json` (devDependency + `test` 스크립트)
- Modify: `src/lib/api/tenancy.ts`
- Modify: `src/lib/api/types.ts` (`Tenancy.status` 타입)
- Modify: `src/lib/api/index.ts` (export 추가)
- Modify: `src/routes/report.$storeId.tsx` (`sameSubCategoryFailures` 계산)

**Interfaces:**

- Produces: `isOccupiedStatus(status: Tenancy["status"]): boolean` — `src/lib/api/tenancy.ts`에서 export, `src/lib/api/index.ts`를 통해 `@/lib/api`에서도 접근 가능.
- Consumes: 기존 `Tenancy` 타입(`src/lib/api/types.ts`), 기존 `findOccupant`(`src/lib/api/tenancy.ts`).

- [ ] **Step 1: Vitest 설치**

Run: `bun add -d vitest`

Expected: `package.json`의 `devDependencies`에 `vitest` 항목이 추가됨(버전은 bun이 해석).

- [ ] **Step 2: `test` 스크립트 추가**

`package.json`의 `scripts` 블록:

```diff
   "scripts": {
     "dev": "vite dev",
     "build": "vite build",
     "build:dev": "vite build --mode development",
     "preview": "vite preview",
     "lint": "eslint .",
-    "format": "prettier --write ."
+    "format": "prettier --write .",
+    "test": "vitest run"
   },
```

- [ ] **Step 3: `vitest.config.ts` 작성**

이 레포의 `vite.config.ts`는 `@lovable.dev/vite-tanstack-config`로 감싸져 있어 플러그인을 직접 추가하면 안 된다(주석에 명시됨). 테스트 대상 모듈(`tenancy.ts`)이 상대 경로 import만 쓰고 `@/` 별칭이나 React/Vite 플러그인을 전혀 필요로 하지 않으므로, 별도의 최소 설정 파일로 분리한다.

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: 실패하는 테스트 작성**

`src/lib/api/tenancy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { findOccupant, isOccupiedStatus } from "./tenancy";
import type { Tenancy } from "./types";

const baseTenancy = (overrides: Partial<Tenancy>): Tenancy => ({
  tenancyId: "t-1",
  businessName: "테스트상점",
  category: "음식_일반음식점영업",
  subCategory: "일반음식점",
  industryDetail: null,
  licensedAt: "2020-01-01",
  closedAt: null,
  status: "영업",
  survivalMonths: 12,
  closedAtEstimated: false,
  enrichmentSource: "license_only",
  marketInfo: {
    isPlaceholder: true,
    leaseAreaSqm: null,
    depositKrw: null,
    monthlyRentKrw: null,
    keyMoneyKrw: null,
    dailyFloatingPopulation: null,
    sameCategoryNearbyCount: null,
    vacancyRatePercent: null,
    asOf: "2026-07-11",
    totalStoreCount: null,
    categoryBreakdown: null,
  },
  ...overrides,
});

describe("isOccupiedStatus", () => {
  it("treats 영업 as occupied", () => {
    expect(isOccupiedStatus("영업")).toBe(true);
  });

  it("treats 휴업 as occupied", () => {
    expect(isOccupiedStatus("휴업")).toBe(true);
  });

  it("treats 폐업 as not occupied", () => {
    expect(isOccupiedStatus("폐업")).toBe(false);
  });

  it("treats off-spec license status strings as not occupied", () => {
    // 2026-07-11 실측: 성남시 수정구 표본에서 실제로 관측된 값(CLAUDE.md 참고)
    expect(isOccupiedStatus("취소/말소/만료/정지/중지")).toBe(false);
    expect(isOccupiedStatus("제외/삭제/전출")).toBe(false);
  });
});

describe("findOccupant", () => {
  it("returns the tenancy whose status is 영업", () => {
    const timeline = [
      baseTenancy({ tenancyId: "t-1", status: "폐업", closedAt: "2019-01-01" }),
      baseTenancy({ tenancyId: "t-2", status: "영업" }),
    ];
    expect(findOccupant(timeline)?.tenancyId).toBe("t-2");
  });

  it("returns null when every tenancy is closed or off-spec", () => {
    const timeline = [
      baseTenancy({ tenancyId: "t-1", status: "폐업", closedAt: "2019-01-01" }),
      baseTenancy({
        tenancyId: "t-2",
        status: "취소/말소/만료/정지/중지",
        closedAt: "2021-01-01",
      }),
    ];
    expect(findOccupant(timeline)).toBeNull();
  });
});
```

- [ ] **Step 5: 실패 확인**

Run: `bunx vitest run`

Expected: FAIL — `tenancy.ts`가 `isOccupiedStatus`를 export하지 않아 "The requested module './tenancy' does not provide an export named 'isOccupiedStatus'" 또는 동등한 import 에러.

- [ ] **Step 6: `isOccupiedStatus` 구현**

`src/lib/api/tenancy.ts` 전체 교체:

```ts
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
```

- [ ] **Step 7: 통과 확인**

Run: `bunx vitest run`

Expected: PASS — 6개 테스트 전부 통과.

- [ ] **Step 8: `Tenancy.status` 타입 확장**

`src/lib/api/types.ts`의 `Tenancy` 인터페이스:

```diff
   closedAt: string | null;
-  status: "영업" | "폐업" | "휴업";
+  // api-spec.md는 "영업"|"폐업"|"휴업" 3값만 선언하지만, 실 배포 백엔드는
+  // 인허가 원본 상태값을 그대로 흘려보내는 경우가 있다(예:
+  // "취소/말소/만료/정지/중지", "제외/삭제/전출" — 2026-07-11 실측, CLAUDE.md
+  // "알려진 스펙-실측 차이" 참고). "영업"/"휴업"만 코드가 실제로 분기하는
+  // 값이라 리터럴로 남기고, 나머지(폐업 포함)는 string으로 수용한다 —
+  // isOccupiedStatus()로 판정할 것.
+  status: "영업" | "휴업" | (string & {});
   survivalMonths: number | null;
```

- [ ] **Step 9: `src/lib/api/index.ts`에 export 추가**

```diff
-export { findOccupant } from "./tenancy";
+export { findOccupant, isOccupiedStatus } from "./tenancy";
```

- [ ] **Step 10: `report.$storeId.tsx`의 `sameSubCategoryFailures` 수정**

import 추가:

```diff
-import { ApiRequestError, buildUnitAnalysis, findOccupant } from "@/lib/api";
+import { ApiRequestError, buildUnitAnalysis, findOccupant, isOccupiedStatus } from "@/lib/api";
```

계산 로직 교체:

```diff
   const sameSubCategoryFailures = current
     ? timeline.filter(
         (t) =>
-          t.status === "폐업" &&
+          !isOccupiedStatus(t.status) &&
           t.tenancyId !== current.tenancyId &&
           t.subCategory === current.subCategory,
       ).length
     : 0;
```

- [ ] **Step 11: 타입체크 + 테스트 + lint 재확인**

Run: `npx tsc --noEmit && bunx vitest run && bun run lint`

Expected: 셋 다 에러 없음(`tsc` 클린, vitest 6개 통과, lint는 Task 1 이후 기준 경고 6개만).

- [ ] **Step 12: 커밋**

```bash
git add vitest.config.ts src/lib/api/tenancy.test.ts package.json \
  src/lib/api/tenancy.ts src/lib/api/types.ts src/lib/api/index.ts \
  src/routes/report.\$storeId.tsx
git commit -m "$(cat <<'EOF'
fix: Tenancy.status 스펙 외 값을 폐업과 동등하게 취급

실 배포 백엔드가 영업/폐업/휴업 외에 인허가 원본 상태값(예:
취소/말소/만료/정지/중지)을 그대로 내려주는 걸 실측으로 확인(전체의
5.2%). isOccupiedStatus() 헬퍼로 판정 기준을 통일하고, 이 값들 때문에
report 페이지의 동일업종 실패 횟수가 실제보다 적게 집계되던 걸 수정.
Vitest를 이 로직 검증용으로 도입.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review 메모 (기록용)

- **스펙 커버리지**: 설계 문서(Section A/B/C, 항목 1~~5)가 Task 1~~7과 1:1로 대응됨. 항목 6(파일 분할)·7(전체 테스트 커버리지)은 설계 문서에서 이미 "재량/팀 판단"으로 범위 밖 처리되어 이 플랜에도 포함하지 않음.
- **플레이스홀더 스캔**: 없음 — 모든 스텝이 실행 가능한 정확한 명령/코드.
- **타입/네이밍 일관성**: `isOccupiedStatus`(Task 3의 CLAUDE.md, Task 7의 구현·테스트·소비처)가 전부 동일 이름으로 일치. `docs/spec/api-spec.md` 경로 문자열이 Task 2/3/4/5/6에서 전부 동일.
