# 성능 개선 + 화면(UI) 개선 + 참조 프로젝트 지도 페이지 폰트 적용 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 이번 세션에서 새로 만든 랜딩(`index.tsx`)·검색/지도(`search.tsx`)·리포트(`report.$storeId.tsx`) 페이지를 대상으로 (1) 실제 성능 문제를 찾아 고치고, (2) 화면(UI/UX) 문제를 찾아 고치고, (3) 참조 프로젝트(`D:\Dev\_Woowahan-Techcourse\woowaTon\client`)의 지도 페이지가 쓰는 폰트 웨이트·크기·트래킹 처리를 우리 검색/지도 페이지에 빠짐없이 반영한다.

**Architecture:** 세 태스크는 서로 다른 관심사(런타임 성능/시각적 완성도/타이포그래피)라 독립적으로 커밋 가능하다. 순서: 성능(구조적 변경이 커서 먼저) → 화면 개선(성능 수정 이후의 최종 렌더 기준으로 스크린샷 비교) → 폰트(가장 지엽적, 마지막에 얹어도 다른 태스크와 충돌 없음).

**Tech Stack:** React 19 + TanStack Start + TanStack Query + Tailwind v4 + shadcn/ui, Vitest, Playwright(로컬 검증용, devDependency 아님 — 스크래치 디렉터리에 임시 설치해 씀).

## Global Constraints

- **투기적 리팩터 금지**: "found a performance/UI issue"는 실제로 관찰 가능한 문제여야 한다(코드를 읽고 "이론상 느릴 수도" 정도로는 부족 — 실제 재현되는 현상이거나 명백한 버그여야 함). 스타일 취향 문제로 이미 확정된 디자인 결정(navy/brand 토큰 체계, 풀페이지 스크롤 스냅 구조, 지도 페이지 오버레이 레이아웃)을 재론하지 않는다.
- **디자인 토큰 고정**: 색은 `src/styles.css`에 이미 정의된 시맨틱 토큰(`navy`/`brand`/`danger`/`warn`/`muted-foreground`/`border` 등)만 쓴다. 새 원색 hex를 추가하지 않는다.
- **데모 모드 브라우저 검증 필수**: 이 레포는 실 백엔드(`VITE_API_BASE_URL=https://turbom.duckdns.org`)가 `localhost`에서의 호출을 CORS로 막는다. 브라우저로 확인할 땐 `.env.local`을 `cp .env.local .env.local.bak && grep -v VITE_API_BASE_URL .env.local.bak > .env.local`로 잠깐 데모 모드로 바꾸고, **작업이 끝나면 반드시 `mv .env.local.bak .env.local`로 원상복구**한다(복구 확인: `cat .env.local`에 `VITE_API_BASE_URL=https://turbom.duckdns.org` 줄이 있어야 함). 커밋 직전에 `git status --short`로 `.env.local`이 깨끗한지 재확인한다.
- **네이버 지도 실호출 불가**: 이 환경은 네이버 지도 API 키가 `localhost` 도메인에 인가돼 있지 않아 지도 타일 자체는 항상 "인증 실패" 표시로 렌더된다(정상 — 코드 문제 아님). 지도 위에 뜨는 오버레이 UI(검색창/패널/핀 등)는 그대로 검증 가능.
- **Playwright는 devDependency로 추가하지 않는다**: 스크래치 디렉터리(예: `%TEMP%\claude\...\scratchpad`)에 `npm install playwright --no-save`로 임시 설치해 로컬 검증에만 쓰고, `package.json`/`bun.lock`은 건드리지 않는다.
- **목데이터로 시나리오 재현할 경우 반드시 원상복구**: `src/lib/mock-data.ts`를 검증용으로 임시 수정했다면, 검증 후 정확히 되돌리고 `git diff --stat src/lib/mock-data.ts`가 빈 출력인지 확인 후 커밋한다.
- **검증 3종 세트**: 각 태스크 커밋 전 `npx tsc --noEmit`(에러 0), `bun run lint`(에러 0, 기존 경고 7개는 그대로 둠), `npx vitest run`(기존 15개 + 태스크에서 추가한 테스트 전부 통과) 모두 통과해야 한다.
- **기존 코드 관례**: 주석은 "왜"를 한국어로, 라우트/컴포넌트는 `@/lib/api` 배럴만 import, Tailwind 유틸리티 클래스 사용(CSS-in-JS 금지).

---

### Task 1: 성능 개선

**Files (조사 대상 — 실제 수정 파일은 조사 결과에 따라 달라짐):**

- `src/components/map-view.tsx`
- `src/routes/search.tsx`
- `src/hooks/use-eased-snap-scroll.ts`
- `src/routes/index.tsx`
- `src/routes/report.$storeId.tsx`
- `src/lib/api/unit-analysis.ts`

**Interfaces:** 없음(순수 최적화 — 컴포넌트의 외부 API/props 시그니처를 바꾸지 않는다. 바꿔야만 고쳐지는 문제라면 보고서에 이유를 남기고 그렇게 해도 됨).

이번 세션에 새로 만든 3개 페이지에서 실제로 관찰 가능한 성능 문제를 찾아 고친다. 이미 알려진 유력 후보 하나를 짚어두지만, 이것만 고치고 끝내지 말고 위 파일들을 직접 읽고 다른 문제도 찾아본다 — 다만 "찾았다"고 주장하려면 실제로 재현 가능해야 한다(예: 특정 상호작용 시 불필요한 재계산/재마운트가 실제로 일어나는지 코드 흐름으로 확인하거나, React DevTools Profiler/`console.count` 등으로 재현).

**알려진 유력 후보**: `src/routes/search.tsx`가 `MapView`에 넘기는 `markers` prop을 `candidates.filter(...).map(...)`로 렌더마다 새 배열을 만들어 전달한다. `MapView`(`src/components/map-view.tsx`)의 마커 렌더 `useEffect`는 `[mapReady, markers]`에 의존하는데, 배열 내용이 같아도 참조가 매번 바뀌므로 이 이펙트가 렌더마다(예: 검색창에 한 글자 입력할 때마다 `input` state가 바뀌어 `SearchPage`가 리렌더될 때마다) 마커를 전부 지웠다가 다시 만들고 `fitBounds`까지 재실행한다 — 실제 후보 목록이 안 바뀌었는데도. 이게 실제로 일어나는지 확인하고(예: 이펙트 안에 임시 `console.log`를 넣어 타이핑할 때마다 찍히는지 확인), 맞다면 `markers` 배열을 후보 데이터(위치·활성 여부)가 실제로 바뀔 때만 새로 만들도록 고친다(`useMemo` 등 — 구체적 구현은 위임).

- [ ] **Step 1: 조사**

`map-view.tsx`, `search.tsx`, `use-eased-snap-scroll.ts`, `index.tsx`, `report.$storeId.tsx`, `unit-analysis.ts`를 읽고 다음을 확인:

1. 위 "알려진 유력 후보"가 실제로 재현되는지(타이핑 시 마커 이펙트가 불필요하게 재실행되는지).
2. `unit-analysis.ts`의 분석(riskLevel/narrative/체크리스트 등) 계산이 `report.$storeId.tsx` 렌더마다 재계산되는지, 그게 실제로 체감될 만큼 무거운지(가벼우면 메모이제이션 불필요 — 억지로 추가하지 않는다).
3. `use-eased-snap-scroll.ts`의 휠 핸들러가 매 이벤트마다 하는 작업 중 불필요하게 반복되는 게 있는지.
4. 그 외 발견한 것이 있으면 같은 기준(실제 재현 가능)으로 판단.

- [ ] **Step 2: 재현되는 문제만 고친다**

발견한 문제 중 실제로 재현되는 것만 고친다. 억지로 몇 개를 채우려 하지 말 것 — 유력 후보 하나만 실재하고 나머지는 문제가 아니라고 결론 나면 그것만 고쳐도 된다. 반대로 유력 후보가 재현되지 않는다면(이미 문제 없음으로 확인되면) 다른 실재하는 문제를 찾아 고친다.

- [ ] **Step 3: 회귀 검증**

Run: `npx tsc --noEmit && bun run lint && npx vitest run`

Expected: 셋 다 에러 없음(vitest 15개 전부 통과).

브라우저로 데모 모드 전환 후(위 Global Constraints 참고) `/search?q=성남시 수정구 신흥동 123` 등에서 검색창에 타이핑하며 지도 마커가 불필요하게 깜빡이지 않는지 확인(고쳤다면). 확인 후 `.env.local` 원상복구.

- [ ] **Step 4: 커밋**

무엇을 왜 고쳤는지, 어떻게 재현/검증했는지 커밋 메시지에 남긴다(형식은 이 플랜의 다른 태스크 커밋 메시지 스타일 참고 — 한국어, "무엇을·왜" 위주, `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` 포함).

---

### Task 2: 화면(UI) 개선

**Files (조사 대상):**

- `src/routes/index.tsx`
- `src/routes/search.tsx`
- `src/routes/report.$storeId.tsx`
- `src/components/site-header.tsx`, `src/components/site-footer.tsx`, `src/components/risk-badge.tsx`, `src/components/map-view.tsx`

**Interfaces:** 없음(시각적 수정 — 기존 컴포넌트 props 시그니처를 바꾸지 않는 선에서 진행. 불가피하면 사유를 보고서에 남긴다).

이번 세션에 여러 차례에 걸쳐 디자인이 바뀐 3개 페이지(랜딩/검색-지도/리포트)를 데스크톱(1280×800)·모바일(390×844) 두 뷰포트에서 Playwright 스크린샷으로 훑어보며, 실제로 눈에 띄는 화면 문제를 찾아 고친다. "더 예쁘게" 같은 취향 재작업이 아니라, 아래 같은 구체적 결함을 찾는 것:

- 포커스 링(`focus-visible`)이 없거나 잘 안 보이는 상호작용 요소(버튼/링크/인풋)
- 좁은 화면에서 잘리거나(overflow) 겹치는 요소
- 로딩/빈/에러 상태 사이에서 스타일이 통일되지 않은 곳(예: 어떤 페이지는 아이콘이 있고 어떤 페이지는 없음 — 의도적 차이가 아니라 놓친 것으로 보이면)
- hover/active 상태가 없거나 어색한 클릭 가능 요소
- 명도 대비가 너무 낮아 읽기 힘든 텍스트

- [ ] **Step 1: 스크린샷 훑어보기**

로컬 dev 서버(데모 모드, 위 Global Constraints 참고)를 띄우고 Playwright로 아래 화면을 1280×800·390×844 두 뷰포트에서 스크린샷:

- `/` 랜딩 5개 섹션 전부
- `/search?q=성남시 수정구 신흥동 123` (결과 있음), `/search`(빈 상태)
- `/report/$storeId`(데모 지번 아무거나 골라 물건 상세까지 진입)

- [ ] **Step 2: 발견한 문제만 고친다**

스크린샷에서 실제로 관찰된 문제만 고친다(위 목록 참고, 완전한 목록은 아님 — 훑어보다 발견한 다른 구체적 결함도 포함 가능). 문제를 못 찾았다면 억지로 만들어내지 않는다 — 그 경우 이 태스크는 "발견된 문제 없음, 스크린샷 근거만 보고서에 남김"으로 끝내도 된다.

- [ ] **Step 3: 회귀 검증**

Run: `npx tsc --noEmit && bun run lint && npx vitest run`

수정한 화면을 다시 스크린샷으로 확인(전/후 비교). 확인 후 `.env.local` 원상복구.

- [ ] **Step 4: 커밋**

발견한 문제와 고친 내용을 커밋 메시지에 남긴다.

---

### Task 3: 참조 프로젝트 지도 페이지 폰트 적용

**Files:**

- Modify: `src/routes/search.tsx` (필요한 곳만)

**Interfaces:** 없음.

**Reference:** `D:\Dev\_Woowahan-Techcourse\woowaTon\client\src\pages\Map.tsx`, `D:\Dev\_Woowahan-Techcourse\woowaTon\client\src\components\ui.tsx`, `D:\Dev\_Woowahan-Techcourse\woowaTon\client\src\index.css`(폰트 선언부).

참조 프로젝트도 우리와 동일하게 Pretendard를 쓴다(`index.css`의 `font-family: Pretendard, ...` — font-family 자체는 이미 같음, 새로 갈아치울 필요 없음). 이 태스크가 실제로 해야 하는 건 참조 프로젝트의 지도 페이지가 폰트를 "어떻게 쓰는지"(굵기·크기·자간 조합)를 우리 `search.tsx`에 빠짐없이 반영하는 것 — 이전 세션에서 이미 일부(브랜드 워드마크 `font-extrabold`+`tracking-[0.22em]` 캡션, 지번 탭 `font-semibold`, `StatusBadge` `font-bold` 등)를 반영했으니, **이미 반영된 부분을 다시 만들지 말고 빠진 부분만 찾아 채운다.**

- [ ] **Step 1: 참조 파일과 우리 `search.tsx`를 나란히 비교**

`Map.tsx`/`ui.tsx`에서 폰트 관련 클래스(`font-black`/`font-extrabold`/`font-bold`/`font-semibold`/`tabular-nums`/`tracking-*`/`text-[…]` 커스텀 크기)가 붙은 모든 텍스트 요소를 나열하고, 우리 `search.tsx`의 대응 요소(있다면)와 비교해 굵기·자간·크기가 다른 곳을 찾는다. 대응 요소가 아예 없는 항목(예: 참조엔 있는데 우리 지도 페이지 UI엔 없는 텍스트 블록)은 이 태스크 범위 밖 — 새 UI를 만드는 게 아니라 기존 요소의 폰트 처리만 맞춘다.

- [ ] **Step 2: 차이 나는 곳만 수정**

찾은 차이만 `search.tsx`에 반영. 색상 토큰은 바꾸지 않는다(참조는 파란 accent를 쓰지만 우리는 브랜드 그린으로 이미 매핑해뒀다 — 이 태스크는 폰트만).

- [ ] **Step 3: 회귀 검증**

Run: `npx tsc --noEmit && bun run lint`

브라우저로 데모 모드 전환 후(위 Global Constraints 참고) `/search?q=성남시 수정구 신흥동 123` 스크린샷으로 변경 확인. 확인 후 `.env.local` 원상복구.

- [ ] **Step 4: 커밋**

무엇을 어디서 맞췄는지 커밋 메시지에 남긴다.

---

## Self-Review 메모 (기록용)

- 세 태스크 모두 서로 다른 파일 영역/관심사라 순서를 바꿔도 충돌 없음(Task 3이 `search.tsx`를 만지므로 Task 1이 같은 파일을 만졌다면 Task 3은 Task 1 이후 최신 상태를 베이스로 시작해야 함 — 순차 실행이므로 자동으로 그렇게 됨).
- Task 1·2는 "찾아서 고쳐라" 형태라 완전한 사전 스펙이 없다 — 의도적: 실제 코드를 조사해야 알 수 있는 성격의 작업이라 명세를 미리 다 쓰면 오히려 억지 결과를 유도한다. 대신 "실제로 재현 가능한 문제만"이라는 판단 기준과 조사 대상 파일 범위를 명확히 못박았다.
- 플레이스홀더 스캔: 없음 — Task 3만 정확한 대상 파일(참조 레포 절대경로)이 있고 나머지는 조사 범위 명시로 대체.
