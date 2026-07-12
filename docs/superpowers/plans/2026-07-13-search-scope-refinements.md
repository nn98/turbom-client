# 검색 범위 정교화: 개수 캡 + 지도 뷰포트 연동 + 구 단위 동 선택 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 검색 결과 범위 제어를 "반경 300m 하나"에서 세 겹으로 넓힌다 — (1) 반경 필터 위에 개수 기반 캡을 추가하고, (2) 지도를 움직이면 패널 목록이 현재 화면(뷰포트)에 보이는 후보만 반영하도록 하고, (3) 검색어가 `구` 단위처럼 넓어서 결과가 여러 `동`에 걸쳐 있으면 `동`을 먼저 고르게 한다.

**Architecture:** 세 기능 다 `src/routes/search.tsx` + `src/lib/geo.ts`(+Task 2는 `src/components/map-view.tsx`)를 만지지만 서로 다른 레이어라 순차 진행 가능 — Task 1(데이터 레이어: 몇 개까지 들고 있을지)이 가장 아래, Task 2(지도↔패널 연동)가 그 위, Task 3(검색 흐름 자체를 바꾸는 UI 게이트)이 가장 위. 이 순서로 태스크를 나눠 각자 독립적으로 커밋 가능하다.

**Tech Stack:** React 19 + TanStack Start + TanStack Query + Tailwind v4, Vitest, 네이버 지도 JS SDK(`window.naver.maps`, npm 타입 없음 — `src/components/map-view.tsx`의 최소 ambient 타입 확장 필요).

## 왜 백엔드 API를 안 건드리는가 (중요 — 반드시 읽을 것)

이 레포(`turbom-client`)는 `docs/spec/api-spec.md`만 규범으로 삼고(`CLAUDE.md` 참고), 그 계약은 `GET /api/sites/search?query=`(문자열 하나) 뿐이다 — 위치 기반 범위 검색(bounding box, 반경 쿼리 파라미터 등)이나 "구 안의 동 목록"을 돌려주는 별도 엔드포인트는 계약에 없다. 이 세 기능 전부 **새 네트워크 요청을 추가하지 않고, 이미 받아온 `candidates[]`(문자열 검색 결과 전체)를 클라이언트에서 후처리하는 방식으로만** 구현한다:

- 개수 캡: 이미 받은 배열을 자르는 것.
- 지도 뷰포트 연동: 이미 받은 배열을 현재 지도 화면 범위로 필터링하는 것(지도를 다시 조회하는 게 아니라 이미 있는 마커 중 화면에 걸리는 것만 패널에 반영).
- 동 선택: 이미 받은 배열의 `jibunAddress`에서 동 이름을 뽑아 그룹핑하는 것. 동을 고르면 `q`에 동 이름을 덧붙여 **같은 `/api/sites/search?query=` 엔드포인트로 좀 더 좁은 문자열**을 다시 요청하는 것뿐 — 새 엔드포인트가 아니다.

## Global Constraints

- 새 네트워크/백엔드 계약 추가 금지(위 설명 참고) — 전부 클라이언트 후처리.
- 디자인 토큰 고정(`navy`/`brand`/`danger`/`warn`/`muted-foreground`/`border` 등 기존 시맨틱 토큰만).
- 데모 모드 브라우저 검증 필수, `.env.local` 임시 전환 후 반드시 원상복구(`cp .env.local .env.local.bak && grep -v VITE_API_BASE_URL .env.local.bak > .env.local` → 확인 후 `mv .env.local.bak .env.local`).
- 네이버 지도는 이 환경(localhost 미인가)에서 항상 "인증 실패"로 뜨고, 마커 재생성 시 SDK 내부 상태가 깨져 크래시가 날 수 있다(2026-07-13 확인, 코드 변경과 무관한 기존 환경 제약 — Task 2에서 특히 주의: 새 이벤트 리스너 추가 시 이 크래시가 늘어나는지 아닌지 구분해서 보고할 것. 재현 안 되면 손대지 않는다).
- Playwright는 devDependency로 추가하지 않는다(스크래치 디렉터리에 `npm install playwright --no-save`).
- 검증 3종 세트: `npx tsc --noEmit`(에러 0), `bun run lint`(에러 0, 기존 경고 7개는 그대로), `npx vitest run`(기존 20개 + 태스크에서 추가한 테스트 전부 통과).
- 기존 코드 관례: 주석은 "왜"를 한국어로, `@/lib/api` 배럴 import, Tailwind 유틸리티 클래스.

---

### Task 1: 반경 필터 위에 개수 캡 추가

**Files:**

- Modify: `src/lib/geo.ts`
- Modify: `src/lib/geo.test.ts`
- Modify: `src/routes/search.tsx`

**Interfaces:**

- Produces: `src/lib/geo.ts`에 새 함수(이름은 구현자 재량, 예: `capByCount` 또는 `withinRadius`에 옵션 파라미터로 통합 — 기존 `withinRadius` 시그니처를 유지할지 확장할지는 구현자가 판단하되, 기존 호출부(`search.tsx`의 유일한 호출부)와 `geo.test.ts`의 기존 9개 테스트가 깨지지 않아야 함).
- Consumes: 기존 `withinRadius`/`centroidOf`/`haversineMeters`(`src/lib/geo.ts`).

현재 `withinRadius`(반경 300m)만으로는, 후보들이 넓게 퍼진 `구` 단위 검색에서 반경 안에 수십 개가 그대로 남을 수 있다(예: 근사 중심점 주변 300m 안에 우연히 20~30개가 몰려 있는 경우). 반경 필터 뒤에 **개수 캡**을 추가한다 — 반경 필터를 통과한 후보를 중심점에서 가까운 순으로 정렬해 상위 N개(예: 20개, 정확한 값은 구현자가 합리적으로 정하고 이유를 남긴다)만 남긴다.

- [ ] **Step 1: 실패하는 테스트 작성(TDD)**

`src/lib/geo.test.ts`에 새 케이스 추가 — 예: 후보 5개(전부 반경 안, 중심점에서의 거리가 다 다름)를 캡 2로 자르면 가장 가까운 2개만 남는지, 캡보다 적으면 그대로인지, 좌표 없는 항목은 개수에 포함되되 위치로 정렬할 수 없으니 뒤로 밀리는지(또는 그대로 통과하는 등 — 구현자가 정하고 테스트로 명시).

- [ ] **Step 2: 구현**

`src/lib/geo.ts`에 개수 캡 로직 추가. 기존 `withinRadius`의 근사 중심점(매칭된 후보 좌표 평균)을 재사용해 거리 정렬 기준으로 삼는다(새로 계산하지 말 것 — 이미 있는 `centroidOf`/`haversineMeters` 재사용).

- [ ] **Step 3: `search.tsx`에 연결**

`SearchPage`의 `candidates` useMemo(현재 `withinRadius(searchQuery.data?.candidates ?? [], SEARCH_RADIUS_METERS)`)에 개수 캡을 이어붙인다. 상수 이름과 값(예: `MAX_CANDIDATES = 20`)에 주석으로 왜 이 값인지(지도 핀이 너무 많으면 클러터·성능 문제, 기존 `MAX_VISIBLE_TABS = 8`보다는 넉넉해야 실제 탭 펼치기가 의미 있음 등) 남긴다.

- [ ] **Step 4: 검증**

Run: `npx tsc --noEmit && bun run lint && npx vitest run`

- [ ] **Step 5: 커밋**

한국어 커밋 메시지, `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` 포함.

---

### Task 2: 지도 뷰포트에 맞춰 패널 목록 갱신

**Files:**

- Modify: `src/components/map-view.tsx`
- Modify: `src/routes/search.tsx`

**Interfaces:**

- Produces: `MapView`에 새 optional prop(예: `onViewportChange?: (bounds: { south: number; west: number; north: number; east: number }) => void`) — 네이버 지도의 `idle` 이벤트(팬/줌이 끝나고 정착했을 때 발생 — `drag`/`zoom_changed`처럼 연속 발생하는 이벤트 말고 이걸 써야 팬 도중 매 프레임 재계산을 안 함)에서 `map.getBounds()`를 읽어 평범한 숫자 4개로 변환해 호출한다.
- Consumes: Task 1이 만든 반경+개수 캡을 통과한 `candidates`(뷰포트 필터는 그 위에 한 겹 더 얹는 것 — 새로 fetch하거나 반경/개수 캡을 대체하지 않는다).

**중요한 설계 결정(반드시 이대로 구현할 것 — 임의로 다르게 짜지 말 것):**

지도 자신의 카메라(센터/줌)를 뷰포트 필터가 다시 움직이면 무한 루프 위험이 있다(필터링된 후보가 바뀜 → 마커 배열이 바뀜 → 이전 태스크에서 만든 `positionsKey` 재센터 로직이 새 위치 집합을 감지 → 다시 지도를 움직임 → 다시 이벤트 발생 → …). 그래서 뷰포트 추적은 **한쪽 방향으로만** 흐른다:

1. `MapView`는 사용자가 지도를 움직인 뒤(`idle`) 현재 화면 범위를 부모에게 "보고"만 한다. 지도 자신의 마커/센터/줌은 이 뷰포트 변화로 인해 다시 조정되지 않는다(기존 `positionsKey` 기반 재센터 로직은 후보 좌표 "집합"이 바뀔 때만 여전히 동작 — 이건 그대로 둔다).
2. `search.tsx`는 이 뷰포트를 받아 **패널(지번 탭/요약/물건 목록)에 보여줄 후보만** 걸러낸다 — `candidates`(Task 1의 반경+개수 캡 결과)는 지도에 꽂히는 마커의 원본으로 그대로 유지하고, 별도의 `visibleCandidates`(뷰포트로 한 번 더 거른 것) 를 패널 렌더링에만 쓴다. 지도 마커 자체(`MapView`에 넘기는 `markers`)는 계속 `candidates`(뷰포트와 무관) 기준으로 유지한다 — 그래야 사용자가 지도를 이리저리 움직여도 원래 검색된 핀들이 사라지지 않고, 패널만 "지금 화면에 보이는 것"으로 좁혀진다.
3. 초기 상태(뷰포트를 아직 한 번도 못 받았을 때, 또는 검색어가 바뀌어 새 후보가 왔을 때)는 `visibleCandidates = candidates`(필터 없음)로 시작한다 — 검색 직후 지도가 아직 안 움직였는데 패널이 비어 보이면 안 된다.
4. `activeCandidate`/`activeJibun` 선택 로직은 `candidates`(원본) 기준을 유지한다 — 뷰포트 밖으로 스크롤됐다고 이미 선택된 자리가 바뀌면 안 된다. 패널의 지번 탭 목록(`SegmentedTabs`)에 넘기는 `items`만 `visibleCandidates` 기준으로 바꾼다.

- [ ] **Step 1: `map-view.tsx`에 뷰포트 보고 기능 추가**

`NaverMap` ambient 인터페이스에 `getBounds(): NaverLatLngBounds` 추가(이미 `NaverLatLngBounds`는 `extend()`만 있음 — 여기에 `getSW(): NaverLatLng`/`getNE(): NaverLatLng` 추가 필요). `NaverLatLng`는 현재 완전히 opaque(`type NaverLatLng = object`, "구성/전달만 하고 속성을 읽지 않는다"는 기존 주석)라 여기서 처음으로 값을 읽어야 한다 — `lat(): number`/`lng(): number` 메서드를 가진 타입으로 넓혀야 한다(네이버 지도 SDK의 실제 `LatLng` 인스턴스가 이 메서드들을 제공함, 참고 저장소 `D:\Dev\_Woowahan-Techcourse\woowaTon\client`는 react-leaflet이라 직접 참고는 안 되니 네이버 공식 SDK 동작을 신뢰해서 구현 후 브라우저 콘솔에서 직접 확인).

지도 `idle` 이벤트에 리스너를 달고(기존 `click` 리스너 등록 패턴 참고), `onViewportChange` prop을 호출한다.

- [ ] **Step 2: `search.tsx`에 뷰포트 상태 + 필터링 추가**

`viewportBounds` state 추가, `MapView`에 `onViewportChange` 연결, `visibleCandidates` 파생값 추가(위 설계 결정 3번 규칙대로 뷰포트가 없으면 폴백). `SegmentedTabs`의 `items`만 `visibleCandidates` 기준으로 바꾸고, `markers`/`activeCandidate` 등 나머지는 `candidates` 기준 유지.

패널에 후보가 있지만(전체 `candidates` 기준) 현재 화면엔 하나도 안 보일 때(뷰포트 필터 결과가 빈 배열일 때) 사용자가 헷갈리지 않게 안내 문구를 하나 추가한다(예: "지도를 움직여 이 지역의 다른 자리를 더 보세요" 같은 — 정확한 문구는 구현자가 이 프로젝트의 기존 카피 톤에 맞춰 정한다).

- [ ] **Step 3: 검증**

Run: `npx tsc --noEmit && bun run lint && npx vitest run`

브라우저(데모 모드)로 후보가 2개 이상인 검색 후, `map.panBy`/`map.setCenter`를 Playwright의 `page.evaluate`로 직접 호출해 지도를 움직이고 `idle` 이벤트가 발생하는지, 패널이 갱신되는지 확인(네이버 지도가 이 환경에서 인증 실패 상태라 실제 지도 이동 UX 자체는 제한적으로만 확인 가능 — 이벤트 리스너가 등록되고 콜백이 호출되는지 정도는 확인 가능. 안 되면 코드 리뷰로 로직만 검증하고 보고서에 그렇게 남긴다).

- [ ] **Step 4: 커밋**

---

### Task 3: `구` 단위 검색 시 `동` 선택 유도

**Files:**

- Modify: `src/lib/site-markers.ts`
- Modify: `src/routes/search.tsx`
- New test file(있다면): `src/lib/site-markers.test.ts`(이미 있으면 케이스 추가)

**Interfaces:**

- Produces: `src/lib/site-markers.ts`에 `jibunAddress`에서 동 이름 자체를 뽑는 새 함수(예: `extractDongToken(jibunAddress: string): string | null`) — 기존 `extractLotLabel`과 달리 검색어(query)에 의존하지 않고 주소 문자열 자체에서 "구 다음, 지번 숫자 앞"에 오는 `동/읍/면/리/가` 접미사 토큰을 찾는다(기존 `DONG_SUFFIX` 정규식 재사용).
- Consumes: Task 1의 `candidates`(반경+개수 캡 결과).

**설계**: `candidates`에서 `extractDongToken`으로 뽑은 동 이름의 **distinct 개수가 2개 이상**이면(= 검색어가 `구` 단위처럼 넓어서 결과가 여러 동에 걸침) 기존 패널 내용(지번 탭/요약/물건 목록) 대신 "동을 선택하세요" 화면을 보여준다 — 동 이름별로 몇 개 자리가 있는지(개수) 함께 보여주는 버튼 목록. 동을 고르면 `navigate({ to: "/search", search: { q: \`${q} ${동이름}\` } })`로 더 좁은 검색어로 다시 조회한다(새 엔드포인트 아님, 기존 `submit`과 동일한 방식). distinct 동이 1개 이하면 기존 흐름 그대로(이 게이트를 거치지 않음).

- [ ] **Step 1: `extractDongToken` 작성 + 테스트(TDD)**

`site-markers.test.ts`(신규 또는 기존 파일에 추가)에 케이스: "경기도 성남시 수정구 신흥동 123-4" → "신흥동", 동 접미사가 없거나 이상한 형식이면 `null`, 여러 동이 섞인 candidates 배열에서 distinct 집합을 뽑는 헬퍼(있다면)까지.

- [ ] **Step 2: `search.tsx`에 동 선택 게이트 추가**

`candidates`(Task 1 결과)로부터 distinct 동 목록을 파생하고, 2개 이상이면 동 선택 UI를 렌더링하도록 분기. 기존 `EmptyState`/`NoResults`/`ErrorState`와 같은 위치(조건부 렌더링 체인)에 자연스럽게 끼워 넣는다 — 새 컴포넌트(`DongPicker` 등, 이름은 구현자 재량)로 분리.

Task 2에서 만든 뷰포트 필터(`visibleCandidates`)는 동 선택 화면에는 적용하지 않는다(동 선택은 그 이전 단계 게이트 — 아직 지번 탭/패널 목록 자체를 안 보여주는 상태이므로 적용할 대상이 없음).

- [ ] **Step 3: 검증**

Run: `npx tsc --noEmit && bun run lint && npx vitest run`

브라우저(데모 모드)로 확인 — 다만 현재 `src/lib/mock-data.ts`의 데모 주소 3개 중 동이 실제로 겹치는 조합이 없다(전부 동 하나에 지번 하나 이상, "성남시 수정구 창곡동 559-4"와 "성남시 수정구 창곡동 513"은 같은 창곡동). 동 선택 게이트가 실제로 뜨는 걸 보려면 목데이터를 검증용으로 임시 수정(예: 서로 다른 동 이름을 가진 candidate를 하나 더 얹은 시나리오)해서 확인하고, **검증 후 정확히 원상복구**한다(`git diff --stat src/lib/mock-data.ts`가 빈 출력이어야 커밋 가능).

- [ ] **Step 4: 커밋**

---

## Self-Review 메모 (기록용)

- Task 2의 "뷰포트는 지도 자신의 카메라를 되돌리지 않는다"는 설계는 무한 루프를 피하기 위한 필수 제약이라 Global Constraints가 아니라 Task 2 본문에 못박아뒀다 — 구현자가 임의로 양방향으로 짜면 안 됨.
- Task 3의 동 선택 게이트는 Task 1(개수 캡을 통과한 candidates)에 의존하므로 반드시 Task 1 이후에 진행한다. Task 2(뷰포트)와는 서로 독립이라 순서를 바꿔도 되지만, 이 플랜은 지도↔패널 연동(Task 2)을 먼저 완성해두면 Task 3에서 "동 선택 이후 패널"이 처음부터 뷰포트 인지 상태로 시작하는 게 자연스러워 이 순서를 권장.
- 플레이스홀더 스캔: 없음 — 정확한 파일 경로와 설계 결정(특히 Task 2의 단방향 데이터 흐름)을 구체적으로 명시함.
