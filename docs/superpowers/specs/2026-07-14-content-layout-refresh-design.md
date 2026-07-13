# 컨텐츠 배치 반영 + 인터렉션 강화 — 설계

## 배경

`origin/turbom_sub`는 `turbom`과 `ef5f4d5`에서 갈라진 뒤 같은 3개 라우트(`index.tsx`/`search.tsx`/`report.$storeId.tsx`)를 독립적으로 리디자인한 브랜치다. 인프라(geo.ts, 테스트, spec 미러, CI, `RiskBadge`/`landing-graphics` 등 공유 컴포넌트)가 통째로 빠져 있어 **브랜치 자체를 병합하지 않는다** — 컨텐츠/배치 아이디어만 골라서 `turbom` 위에 재구현한다.

두 브랜치 비교(Explore 서브에이전트 조사 + 사용자 확인)로 정한 채택 범위:

| 항목 | turbom (현재) | turbom_sub | 결정 |
|---|---|---|---|
| 위험도 바 | 단색 바 + 안정/위험 2단계 | 그라데이션 + 5단계 범례 | **그라데이션 채택**, 단 원색 대신 채도 낮춘 톤 |
| 운영 이력 레이아웃 | 세로 목록 | 가로 스크롤 타임라인 | **가로 스크롤 채택** |
| 위험도 표현 위젯 | 공용 `RiskBadge` | 별점(★★★★☆) | **`RiskBadge` 유지** (교체 안 함) |
| 랜딩 페이지 구조/그래픽 | 5섹션 + 전용 그래픽 | 4섹션, 그래픽 없음 | 변경 없음 (turbom이 더 발전된 상태) |
| 지도/데이터 로직(반경·뷰포트·동선택) | 있음 | 없음 | 변경 없음 (turbom_sub엔 아예 없는 기능) |

나머지(지번 라벨, 물건 행, SECTION 번호, 스크롤 UX)는 사용자가 직접 지정한 구체적 요구사항을 그대로 스펙화했다.

## Task 1 — 지번 라벨 접미어 정리 (`src/lib/site-markers.ts`)

`extractLotLabel`이 반환하는 마지막 토큰에 "번지" 같은 접미어가 실 데이터에 섞여 있으면 탭 라벨이 "123-4" / "56번지"처럼 표기가 들쭉날쭉해진다. 반환 직전에 숫자·하이픈 이외의 후행 문자를 잘라내는 정규화 한 줄을 추가한다 (`replace(/[^\d-]+$/, "")`). 특정 단어("번지")만 하드코딩하지 않고 일반화해서 유사한 접미어도 함께 커버한다.

## Task 2 — 가로 스크롤 엣지 힌트 (신규 공용 훅 + 컴포넌트)

`SegmentedTabs`(지번 탭 목록)와 Task 4의 타임라인 스트립 둘 다 "가로 스크롤 + 네이티브 스크롤바 숨김 + 끝에 도달하면 반대쪽 페이드/화살표로 전환"이 필요하므로 한 번만 구현해 재사용한다.

- `src/hooks/use-edge-scroll.ts` — `useEdgeScroll(ref)`: `scroll` 이벤트로 `canScrollLeft`/`canScrollRight`를 추적하고, `scrollByStep(direction)`(`scrollBy({ left: ±160, behavior: "smooth" })`)을 반환. 기존 `use-eased-snap-scroll.ts`와 같은 훅 컨벤션.
- `src/components/edge-scroller.tsx` — 스크롤 컨테이너를 감싸는 프레젠테이션 컴포넌트. `canScrollRight`일 때만 우측에 `bg-gradient-to-l from-surface` 페이드 + 화살표 버튼(`ChevronRight`)을 보여주고 클릭 시 `scrollByStep("right")`, 좌측도 대칭 동작. 네이티브 스크롤바는 `scrollbar-width:none`/`::-webkit-scrollbar{display:none}` 유틸(`styles.css`에 `.no-scrollbar` 추가)로 숨긴다.
- 화살표에 은은한 좌우 nudge 애니메이션(`@keyframes edge-nudge`, `motion-safe:` variant로 `prefers-reduced-motion` 존중) — "오른쪽에 더 있다"는 걸 알리는 유일한 움직임이라 가볍게만 준다.
- `SegmentedTabs`는 기존 `overflow-x-auto` 트랙을 `EdgeScroller`로 교체. 슬라이딩 하이라이트·"+N개" 버튼 로직은 그대로 둔다.

## Task 3 — 물건 행 3줄 고정 레이아웃 + 스켈레톤 (`search.tsx` UnitList)

현재는 점포명이 있을 때만 줄이 추가돼 카드 높이가 공실/영업 사이에서 달라진다. 요청대로 항상 3줄을 고정 높이로 예약한다:

1. `{상세주소(label)} {영업상태 배지}` — 기존과 동일
2. `{가게명}` — 내용 없어도(`공실`이거나 이름 미상) 같은 높이의 빈 줄로 자리 예약
3. `{업종} · 평균 {N}개월` — 신규. `UnitSummary`엔 "현재 입주자가 지금까지 운영한 기간"이 없어서(그 값은 물건 상세의 `Tenancy.survivalMonths`에만 있음, 목록 API는 `averageSurvivalMonths`—전체 이력 평균—만 제공) **"영업 기간"은 `averageSurvivalMonths`로 매핑**한다. 업종은 `industryDetail`, 둘 다 null이면 "-"로 고정 표시(줄 자체는 항상 유지).

`UnitListSkeleton`도 이 3줄 구조를 그대로 흉내내도록(라벨+배지 바 / 이름 바 / 업종·기간 바) 다시 그려서, 실제 데이터가 도착했을 때 카드 높이가 튀지 않게 한다.

## Task 4 — 리포트 페이지 (`report.$storeId.tsx`)

- **SECTION 번호**: `Section` 컴포넌트에 `number: string` prop 추가(호출부에서 "01"~"06" 명시), 제목 위에 작은 라벨로 표시.
- **RiskCard 그라데이션 바**: 단색 바 → `--color-brand`→`--color-warn`→`--color-danger`를 `color-mix()`로 화이트와 섞어 채도를 낮춘 5단계 그라데이션. 바 아래 "매우 안정 / 안정 / 보통 / 위험 / 매우 위험" 5단계 라벨(현재 `level`에 해당하는 단계를 굵게 강조).
- **TimelineCard 가로 스크롤 개편**: 세로 divide-y 목록 → `EdgeScroller`로 감싼 가로 스크롤 스트립. 각 이력을 고정폭 카드(상태링 점 + 기간 + 상호명 + 업종)로, 카드들 뒤에 연결선(절대배치 `border-t`)을 얇게 깐다. 선택 로직(`selectedId`)과 아래 상세 카드는 그대로 유지 — 레이아웃만 바뀐다.
- `sameSubCategoryFailures` 계산 로직, WCAG 대비 수정 등 기존 로직/접근성 수정은 건드리지 않는다(turbom_sub는 이 부분이 오히려 퇴보돼 있었음 — 참고만 하고 가져오지 않음).

## 애니메이션 범위

사용자가 선택한 수준: **가벼운 마이크로 인터랙션만**. Task 2의 엣지 힌트 nudge가 이번 라운드의 유일한 신규 애니메이션이고, 그 외엔 이미 있는 `transition hover:` 패턴에 버튼/카드 클릭 피드백(`active:scale-[0.98]`) 정도만 얹는다. 통계 숫자 카운트업, 섹션 진입 스태거, 타임라인 카드 순차 등장 같은 건 이번 스코프에 넣지 않는다(더 원하면 다음 라운드에 별도 요청).

## 하지 않는 것 (명시적 스코프 제외)

- turbom_sub 브랜치 병합/체리픽 커밋 가져오기 — 코드는 새로 작성, 컨텐츠/배치만 참고
- 랜딩 페이지(`index.tsx`) 섹션 구조·그래픽 변경 — turbom이 이미 더 앞서 있음
- 위험도 위젯을 별점으로 교체 — `RiskBadge` 유지로 확정
- 지도 마커 자체의 애니메이션 — Naver 지도는 이 환경에서 인증이 안 돼 검증 불가, 스코프 밖
- `docs/spec/api-spec.md`/`docs/spec/frontend-spec.md` 수정 — 이 두 파일은 서버 레포 미러라 로컬에서 고치지 않음(`CLAUDE.md` §2). "명세 최신화"는 이 설계 문서 자체를 가리킴.

## 검증 계획

- `npx tsc`/lint/vitest 통과
- Playwright로 각 화면 스크린샷: 지번 탭 스크롤(끝까지 스크롤 시 페이드 반전 확인), 물건 목록 공실/영업 카드 높이 동일 여부, 리포트 위험도 바 5단계, 타임라인 가로 스크롤
- Naver 지도 인증 실패는 기존과 동일하게 환경 한계로 문서화(코드 변경과 무관함을 `git stash` A/B로 재확인)
