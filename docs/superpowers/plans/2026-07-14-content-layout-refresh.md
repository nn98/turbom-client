# 컨텐츠 배치 반영 + 인터렉션 강화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** turbom_sub 브랜치와 참조 레포에서 검증한 컨텐츠/배치 아이디어를 turbom에 이식하고, 폰트 미로드 버그를 고치고, 지도(검색) 페이지의 디자인 언어를 기준으로 나머지 두 페이지(랜딩/리포트)를 일원화한다.

**Architecture:** 기존 3개 라우트 파일(`index.tsx`/`search.tsx`/`report.$storeId.tsx`)과 공유 컴포넌트(`site-header.tsx`/`site-footer.tsx`)를 그대로 두고 그 안의 마크업/스타일/헬퍼 함수만 수정한다. 가로 스크롤 엣지 힌트(페이드+화살표)는 지번 탭과 운영이력 타임라인 두 곳에서 재사용해야 하므로 신규 훅(`use-edge-scroll.ts`)+순수 로직(`edge-scroll.ts`)+프레젠테이션 컴포넌트(`edge-scroller.tsx`)로 한 번만 만든다.

**Tech Stack:** React 18 + TypeScript + TanStack Router + Tailwind CSS v4 + shadcn/ui + Vitest. 새 npm 의존성 없음(순수 CSS/JS로 해결).

## Global Constraints

- `docs/spec/api-spec.md`/`docs/spec/frontend-spec.md`는 서버 레포 미러라 이 계획의 어떤 태스크도 이 두 파일을 수정하지 않는다(`CLAUDE.md` §2).
- `origin/turbom_sub` 브랜치를 병합/체리픽하지 않는다 — 컨텐츠 아이디어만 참고해 새로 작성한다(설계 문서 참고).
- 새 npm 패키지를 추가하지 않는다. `package-lock.json`을 커밋하지 않는다(`bun.lock`이 유일한 락파일).
- Playwright는 devDependency로 추가하지 않는다 — 필요하면 스크래치패드에서 `npm install playwright --no-save`로만 임시 설치.
- 브라우저 검증을 위해 `.env.local`을 임시로 바꿨다면(데모 모드 해제 등) 작업 종료 전 원래 값으로 정확히 복원한다.
- `src/lib/mock-data.ts`를 테스트 목적으로 임시 수정했다면 커밋 전 정확히 원복한다.
- 이 환경의 Naver Maps 클라이언트 ID는 `localhost` 인증이 안 돼 지도 타일 렌더링이 항상 실패한다(알려진 환경 한계, 코드 문제 아님) — 이 계획의 어떤 태스크도 이 문제를 "고치려" 하지 않는다.
- 각 태스크 종료 시 `npx tsc --noEmit`, lint, `npx vitest run` 전부 통과해야 한다.
- `RiskBadge` 컴포넌트를 별점 등 다른 위젯으로 교체하지 않는다(설계 문서에서 확정: 유지).
- `index.tsx`의 섹션 구조(5개 풀스크린 스냅 섹션)·전용 그래픽 컴포넌트는 변경하지 않는다 — 이번 계획은 표면 스타일(그림자·폰트 굵기·패딩)만 손댄다.

---

## Task 1: 지번 라벨 접미어 정규화

**Files:**
- Modify: `src/lib/site-markers.ts`
- Test: `src/lib/site-markers.test.ts`

**Interfaces:**
- Consumes: 없음 (기존 `extractLotLabel(jibunAddress, query)` 시그니처 그대로)
- Produces: `extractLotLabel`의 반환값이 이제 숫자·하이픈 이외의 후행 문자(예: "번지")를 포함하지 않음 — Task 2/3/4는 이 함수의 존재만 알면 되고 내부 변경은 무관.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/site-markers.test.ts`의 `describe("extractLotLabel", ...)` 블록에 아래 두 케이스를 추가한다:

```ts
  it("strips a trailing non-numeric suffix like '번지' for label consistency", () => {
    expect(extractLotLabel("성남시 수정구 신흥동 123번지 상가빌딩", "신흥동 123")).toBe("123");
  });

  it("keeps a lot number with a sub-number intact after stripping the suffix", () => {
    expect(extractLotLabel("성남시 수정구 신흥동 123-4번지", "신흥동 123")).toBe("123-4");
  });
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/lib/site-markers.test.ts`
Expected: 위 두 케이스 FAIL (현재는 "123번지", "123-4번지"를 그대로 반환).

- [ ] **Step 3: 최소 구현**

`src/lib/site-markers.ts`에서 `extractLotLabel` 위에 헬퍼를 추가하고 두 반환 지점에 적용한다:

```ts
// 실 데이터의 지번 토큰에 "번지" 같은 접미어가 섞여 있으면 탭 라벨이
// "123-4" / "56번지"처럼 표기가 들쭉날쭉해진다 — 숫자를 포함한 토큰에서만
// 후행 비숫자·비하이픈 문자를 잘라낸다(순수 텍스트 폴백 토큰은 건드리지 않음).
const stripLotSuffix = (token: string): string =>
  /\d/.test(token) ? token.replace(/[^\d-]+$/, "") : token;

export const extractLotLabel = (jibunAddress: string, query: string): string => {
  const tokens = jibunAddress.trim().split(/\s+/);
  const queryTokens = query.trim().split(/\s+/).filter(Boolean);
  const dongToken = queryTokens
    .slice()
    .reverse()
    .find((t) => DONG_SUFFIX.test(t));
  if (dongToken) {
    const idx = tokens.findIndex((t) => t === dongToken);
    if (idx !== -1 && idx + 1 < tokens.length) return stripLotSuffix(tokens[idx + 1]);
  }
  return stripLotSuffix(tokens[tokens.length - 1] ?? jibunAddress);
};
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/site-markers.test.ts`
Expected: 전체 PASS (기존 케이스 포함 총 12개).

- [ ] **Step 5: 커밋**

```bash
git add src/lib/site-markers.ts src/lib/site-markers.test.ts
git commit -m "fix: 지번 탭 라벨의 번지 등 접미어 정규화"
```

---

## Task 2: 가로 스크롤 엣지 힌트 (신규 훅 + 컴포넌트) + 지번 탭 적용

**Files:**
- Create: `src/lib/edge-scroll.ts`
- Create: `src/lib/edge-scroll.test.ts`
- Create: `src/hooks/use-edge-scroll.ts`
- Create: `src/components/edge-scroller.tsx`
- Modify: `src/routes/search.tsx` (`SegmentedTabs` 함수만)
- Modify: `src/styles.css`

**Interfaces:**
- Produces: `edgeScrollState(metrics: { scrollLeft: number; scrollWidth: number; clientWidth: number }): { canScrollLeft: boolean; canScrollRight: boolean }` (순수 함수, `src/lib/edge-scroll.ts`).
- Produces: `useEdgeScroll(ref: RefObject<HTMLElement | null>, deps?: unknown[]): { canScrollLeft: boolean; canScrollRight: boolean; scrollByStep: (direction: "left" | "right") => void }` (`src/hooks/use-edge-scroll.ts`).
- Produces: `EdgeScroller({ scrollRef, deps, children, fadeClassName }: { scrollRef: RefObject<HTMLDivElement | null>; deps?: unknown[]; children: React.ReactNode; fadeClassName?: string })` — children으로 넘긴 스크롤 컨테이너를 감싸 좌우 페이드+화살표를 오버레이한다. `fadeClassName` 기본값 `"from-surface"` (report 페이지의 카드 배경이 다르면 Task 4에서 오버라이드).
- Consumes (Task 4에서): 이 컴포넌트/훅을 그대로 import해서 재사용.

- [ ] **Step 1: 순수 로직 실패 테스트 작성**

`src/lib/edge-scroll.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { edgeScrollState } from "./edge-scroll";

describe("edgeScrollState", () => {
  it("reports no scroll room when content fits entirely", () => {
    expect(edgeScrollState({ scrollLeft: 0, scrollWidth: 300, clientWidth: 400 })).toEqual({
      canScrollLeft: false,
      canScrollRight: false,
    });
  });

  it("reports only right scroll room at the start", () => {
    expect(edgeScrollState({ scrollLeft: 0, scrollWidth: 800, clientWidth: 400 })).toEqual({
      canScrollLeft: false,
      canScrollRight: true,
    });
  });

  it("reports only left scroll room at the end", () => {
    expect(edgeScrollState({ scrollLeft: 400, scrollWidth: 800, clientWidth: 400 })).toEqual({
      canScrollLeft: true,
      canScrollRight: false,
    });
  });

  it("reports both directions in the middle", () => {
    expect(edgeScrollState({ scrollLeft: 200, scrollWidth: 800, clientWidth: 400 })).toEqual({
      canScrollLeft: true,
      canScrollRight: true,
    });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/lib/edge-scroll.test.ts`
Expected: FAIL with "Cannot find module './edge-scroll'"

- [ ] **Step 3: 순수 로직 구현**

`src/lib/edge-scroll.ts`:

```ts
export interface ScrollMetrics {
  scrollLeft: number;
  scrollWidth: number;
  clientWidth: number;
}

// 서브픽셀 반올림 오차 때문에 정확히 0 / scrollWidth-clientWidth로 비교하면
// 오탐(끝에 도달했는데도 화살표가 안 사라짐 등)이 잦아 1px 여유를 둔다.
export function edgeScrollState(metrics: ScrollMetrics): {
  canScrollLeft: boolean;
  canScrollRight: boolean;
} {
  const { scrollLeft, scrollWidth, clientWidth } = metrics;
  return {
    canScrollLeft: scrollLeft > 1,
    canScrollRight: scrollLeft + clientWidth < scrollWidth - 1,
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/edge-scroll.test.ts`
Expected: PASS (4/4)

- [ ] **Step 5: 훅 작성 (테스트 없음 — 이 레포 컨벤션상 DOM 이벤트를 직접 다루는 훅은 `use-eased-snap-scroll.ts`처럼 유닛테스트 대상이 아니고 Step 8의 Playwright로 검증)**

`src/hooks/use-edge-scroll.ts`:

```ts
import { useEffect, useState, type RefObject } from "react";
import { edgeScrollState } from "@/lib/edge-scroll";

const SCROLL_STEP_PX = 160;

// deps는 목록 길이 등 스크롤 가능 폭에 영향을 주는 값을 넘겨받아, 컨테이너
// 자체 리사이즈 없이 자식 개수만 바뀌는 경우에도 재계산되게 한다(SegmentedTabs의
// "+N개" 펼침, TimelineCard의 이력 개수 등).
export function useEdgeScroll(ref: RefObject<HTMLElement | null>, deps: unknown[] = []) {
  const [state, setState] = useState({ canScrollLeft: false, canScrollRight: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () =>
      setState(
        edgeScrollState({
          scrollLeft: el.scrollLeft,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
        }),
      );
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const scrollByStep = (direction: "left" | "right") => {
    ref.current?.scrollBy({
      left: direction === "right" ? SCROLL_STEP_PX : -SCROLL_STEP_PX,
      behavior: "smooth",
    });
  };

  return { ...state, scrollByStep };
}
```

- [ ] **Step 6: styles.css에 스크롤바 숨김 유틸 + nudge 애니메이션 추가**

`src/styles.css`의 기존 `@utility text-balance { ... }` 블록 바로 아래에 추가:

```css
@utility no-scrollbar {
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
}
```

그리고 파일 끝(`:focus-visible` 블록 뒤)에 추가:

```css
/* 가로 스크롤 엣지 힌트 화살표 — "이 방향에 더 있다"는 걸 알리는 유일한
   움직임이라 가볍게만 준다. prefers-reduced-motion 사용자는 애니메이션 없이
   화살표만 정적으로 보인다(기존 section-enter-fade와 같은 처리 방식). */
@media (prefers-reduced-motion: no-preference) {
  .edge-nudge-left {
    animation: edge-nudge-left 1.6s ease-in-out infinite;
  }
  .edge-nudge-right {
    animation: edge-nudge-right 1.6s ease-in-out infinite;
  }
}
@keyframes edge-nudge-left {
  0%,
  100% {
    transform: translateX(0);
  }
  50% {
    transform: translateX(-2px);
  }
}
@keyframes edge-nudge-right {
  0%,
  100% {
    transform: translateX(0);
  }
  50% {
    transform: translateX(2px);
  }
}
```

- [ ] **Step 7: EdgeScroller 컴포넌트 작성**

`src/components/edge-scroller.tsx`:

```tsx
import { type ReactNode, type RefObject } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEdgeScroll } from "@/hooks/use-edge-scroll";

// 가로 스크롤 컨테이너를 감싸 좌우 끝에 도달했는지에 따라 페이드+화살표를
// 오버레이하는 프레젠테이션 컴포넌트. children은 호출부가 이미
// `no-scrollbar overflow-x-auto`를 걸어 scrollRef를 붙인 실제 스크롤
// 엘리먼트여야 한다 — 이 컴포넌트는 그 위에 겹치는 장식만 그린다.
export function EdgeScroller({
  scrollRef,
  deps = [],
  children,
  fadeClassName = "from-surface",
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
  deps?: unknown[];
  children: ReactNode;
  fadeClassName?: string;
}) {
  const { canScrollLeft, canScrollRight, scrollByStep } = useEdgeScroll(scrollRef, deps);

  return (
    <div className="relative flex min-w-0 flex-1 items-center">
      {canScrollLeft && (
        <>
          <div
            aria-hidden
            className={
              "pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r to-transparent " +
              fadeClassName
            }
          />
          <button
            type="button"
            aria-label="왼쪽으로 스크롤"
            onClick={() => scrollByStep("left")}
            className="edge-nudge-left absolute left-0.5 z-20 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface text-muted-foreground shadow-card transition hover:text-navy"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        </>
      )}
      {children}
      {canScrollRight && (
        <>
          <div
            aria-hidden
            className={
              "pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l to-transparent " +
              fadeClassName
            }
          />
          <button
            type="button"
            aria-label="오른쪽으로 스크롤"
            onClick={() => scrollByStep("right")}
            className="edge-nudge-right absolute right-0.5 z-20 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface text-muted-foreground shadow-card transition hover:text-navy"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 8: `SegmentedTabs`에 적용 (`src/routes/search.tsx`)**

기존:

```tsx
  return (
    <div className="flex items-center gap-1.5">
      <div
        ref={containerRef}
        role="radiogroup"
        className="relative flex min-w-0 flex-1 gap-1 overflow-x-auto rounded-full bg-secondary p-1"
      >
```

교체:

```tsx
  return (
    <div className="flex items-center gap-1.5">
      <EdgeScroller scrollRef={containerRef} deps={[visibleItems.length]} fadeClassName="from-secondary">
        <div
          ref={containerRef}
          role="radiogroup"
          className="no-scrollbar relative flex min-w-0 flex-1 gap-1 overflow-x-auto rounded-full bg-secondary p-1"
        >
```

그리고 그 아래, 기존:

```tsx
        {visibleItems.map((it) => (
          <button
            key={it.id}
            data-id={it.id}
            role="radio"
            aria-checked={it.id === activeId}
            onClick={() => onChange(it.id)}
            className={
              "relative z-10 shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors " +
              (it.id === activeId
                ? "text-navy-foreground"
                : "text-muted-foreground hover:text-navy")
            }
          >
            {it.label}
          </button>
        ))}
      </div>
      {/* 스크롤 트랙 안에 같이 두면 스크롤해야만 보여서 존재를 알아채기 어렵다
          — 항상 보이는 자리에 별도로 둔다. */}
      {hiddenCount > 0 && (
```

교체 (`</div>` 뒤에 `</EdgeScroller>`를 추가로 닫는 것만 다름, 나머지는 동일):

```tsx
        {visibleItems.map((it) => (
          <button
            key={it.id}
            data-id={it.id}
            role="radio"
            aria-checked={it.id === activeId}
            onClick={() => onChange(it.id)}
            className={
              "relative z-10 shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors " +
              (it.id === activeId
                ? "text-navy-foreground"
                : "text-muted-foreground hover:text-navy")
            }
          >
            {it.label}
          </button>
        ))}
        </div>
      </EdgeScroller>
      {/* 스크롤 트랙 안에 같이 두면 스크롤해야만 보여서 존재를 알아채기 어렵다
          — 항상 보이는 자리에 별도로 둔다. */}
      {hiddenCount > 0 && (
```

`fadeClassName="from-secondary"`인 이유: 탭 트랙 배경이 `bg-secondary`라 페이드도 같은 색에서 시작해야 이질감이 없다(기본값 `from-surface`는 Task 4의 카드 배경용).

`search.tsx` 상단 import에 추가:

```ts
import { EdgeScroller } from "@/components/edge-scroller";
```

- [ ] **Step 9: 타입/린트/전체 테스트 확인**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 errors, 전체 테스트 PASS.

- [ ] **Step 10: 커밋**

```bash
git add src/lib/edge-scroll.ts src/lib/edge-scroll.test.ts src/hooks/use-edge-scroll.ts src/components/edge-scroller.tsx src/routes/search.tsx src/styles.css
git commit -m "feat: 가로 스크롤 엣지 힌트(페이드+화살표) 훅/컴포넌트 추가, 지번 탭에 적용"
```

---

## Task 3: 물건 행 3줄 고정 레이아웃 + 스켈레톤 개편

**Files:**
- Modify: `src/routes/search.tsx` (`UnitList`, `UnitListSkeleton`, 호출부)

**Interfaces:**
- Consumes: `UnitSummary` 타입(`src/lib/api`)의 `industryDetail`, `averageSurvivalMonths` 필드 (이미 존재, 스펙 변경 없음).
- Produces: 없음 (다른 태스크가 이 함수들을 참조하지 않음).

- [ ] **Step 1: `UnitList` 호출부에서 이제 안 쓰는 `jibunAddress` prop 제거**

`SearchPage` 안, `<UnitList ... />` 호출부(약 292번째 줄 부근):

```tsx
                    <UnitList
                      units={siteDetailQuery.data?.units ?? []}
                      jibunAddress={activeCandidate?.jibunAddress ?? ""}
                      onSelect={goToReport}
                    />
```

교체:

```tsx
                    <UnitList units={siteDetailQuery.data?.units ?? []} onSelect={goToReport} />
```

- [ ] **Step 2: `UnitList` 시그니처에서 `jibunAddress` 제거, 업종·평균운영기간 표시 헬퍼 추가**

`UnitList` 함수 시그니처:

```tsx
function UnitList({
  units,
  jibunAddress,
  onSelect,
}: {
  units: UnitSummary[];
  jibunAddress: string;
  onSelect: (storeId: string) => void;
}) {
```

교체:

```tsx
function UnitList({
  units,
  onSelect,
}: {
  units: UnitSummary[];
  onSelect: (storeId: string) => void;
}) {
```

같은 파일에서 `displayUnitLabel` 함수 바로 아래에 헬퍼를 추가한다:

```ts
// 물건 목록 행 3번째 줄(업종·운영기간). UnitSummary엔 "현재 입주자가 지금까지
// 운영한 기간"이 없다(그 값은 물건 상세의 Tenancy.survivalMonths에만 있고,
// 이 목록 API는 averageSurvivalMonths—전체 이력 평균—만 준다) — 그래서
// "영업 기간"은 averageSurvivalMonths로 표시한다.
const unitDetailLine = (u: UnitSummary): string => {
  const parts: string[] = [];
  if (u.industryDetail) parts.push(u.industryDetail);
  if (u.averageSurvivalMonths != null) parts.push(`평균 ${u.averageSurvivalMonths}개월`);
  return parts.length ? parts.join(" · ") : "-";
};
```

- [ ] **Step 3: 행 마크업을 3줄 고정 구조로 교체**

기존:

```tsx
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-navy">{displayUnitLabel(u.label)}</span>
                  <StatusBadge status={u.currentStatus} />
                </div>
                {/* 영업 정보(라벨+상태)와 점포명을 한 줄에 같이 넣으면 점포명 유무에 따라
                    줄바꿈 여부가 카드마다 달라져 카드 높이가 들쭉날쭉해진다 — 점포명은
                    항상 자기 줄을 갖게 분리해서 카드 높이를 예측 가능하게 만든다. */}
                {u.currentStatus === "영업" && u.currentBusinessName ? (
                  <p className="mt-1 truncate text-sm font-semibold text-navy">
                    {u.currentBusinessName}
                  </p>
                ) : null}
                <p className="mt-1.5 line-clamp-1 text-xs text-muted-foreground">{jibunAddress}</p>
              </div>
```

교체:

```tsx
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-navy">{displayUnitLabel(u.label)}</span>
                  <StatusBadge status={u.currentStatus} />
                </div>
                {/* 2·3번째 줄은 내용이 없어도 고정 높이(h-5/h-4)로 항상 자리를
                    예약한다 — 그러지 않으면 점포명·업종 유무에 따라 공실/영업
                    카드 높이가 서로 달라진다. */}
                <p className="mt-1 h-5 truncate text-sm font-semibold text-navy">
                  {u.currentStatus === "영업" && u.currentBusinessName ? u.currentBusinessName : ""}
                </p>
                <p className="mt-1.5 h-4 truncate text-xs text-muted-foreground">
                  {unitDetailLine(u)}
                </p>
              </div>
```

- [ ] **Step 4: `UnitListSkeleton`을 3줄 구조로 다시 그리기**

기존:

```tsx
function UnitListSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-16 rounded-xl" />
      <Skeleton className="h-16 rounded-xl" />
    </div>
  );
}
```

교체:

```tsx
function UnitListSkeleton() {
  return (
    <ul className="space-y-2">
      {[0, 1].map((i) => (
        <li key={i} className="rounded-xl border border-border/70 bg-surface p-3.5">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-16 rounded" />
            <Skeleton className="h-4 w-10 rounded-full" />
          </div>
          <Skeleton className="mt-1 h-5 w-28 rounded" />
          <Skeleton className="mt-1.5 h-4 w-36 rounded" />
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 5: 타입 확인 (이 파일은 라우트 컴포넌트라 유닛테스트 없음 — Step 6에서 Playwright로 검증)**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Playwright로 시각 검증**

`.env.local`에서 `VITE_API_BASE_URL=https://turbom.duckdns.org`로 임시 전환(데모 모드 해제) 후 `npm run dev`, 스크래치패드에 임시 스크립트로 `/search?q=성남시 수정구 신흥동 123` 방문:
- 공실 물건 카드와 영업 중 물건 카드의 높이가 동일한지 스크린샷으로 확인
- 업종/평균운영기간 줄이 3번째 줄에 표시되는지 확인
- 로딩 중 스켈레톤이 실제 카드와 비슷한 3줄 형태인지 확인
검증 후 `.env.local`을 원래 값으로 정확히 복원.

- [ ] **Step 7: 커밋**

```bash
git add src/routes/search.tsx
git commit -m "feat: 물건 목록 행을 3줄 고정 레이아웃으로 개편, 스켈레톤도 동일 구조로"
```

---

## Task 4: 리포트 페이지 — SECTION 번호 / 위험도 그라데이션 범례 / 타임라인 가로 스크롤

**Files:**
- Modify: `src/routes/report.$storeId.tsx`
- Modify: `src/lib/api/unit-analysis.ts` (한 줄: `RISK_LABELS` export)

**Interfaces:**
- Consumes: Task 2의 `EdgeScroller`(`@/components/edge-scroller`), `useRef`.
- Consumes: `src/lib/api/unit-analysis.ts`의 `RISK_LABELS: Record<RiskLevel, string>` (export 추가 후 `@/lib/api`를 통해 re-export되는지 확인 — 아래 Step 1에서 barrel 파일 경유 여부 체크).

- [ ] **Step 1: `RISK_LABELS` export 및 barrel 확인**

`src/lib/api/unit-analysis.ts`에서:

```ts
const RISK_LABELS: Record<RiskLevel, string> = {
```

교체:

```ts
export const RISK_LABELS: Record<RiskLevel, string> = {
```

`src/lib/api/client.ts:31-33`이 barrel 역할을 한다:

```ts
// Gray-zone analysis layered on top of UnitDetail — see unit-analysis.ts.
export { buildUnitAnalysis } from "./unit-analysis";
export type { RiskLevel, UnitAnalysis } from "./unit-analysis";
```

`RISK_LABELS`가 빠져 있으므로 한 줄 추가:

```ts
// Gray-zone analysis layered on top of UnitDetail — see unit-analysis.ts.
export { buildUnitAnalysis, RISK_LABELS } from "./unit-analysis";
export type { RiskLevel, UnitAnalysis } from "./unit-analysis";
```

- [ ] **Step 2: `Section` 컴포넌트에 번호 표시 추가**

기존:

```tsx
function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-2xl font-bold tracking-tight text-navy sm:text-3xl">{title}</h2>
      {subtitle ? <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p> : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}
```

교체:

```tsx
function Section({
  number,
  title,
  subtitle,
  children,
}: {
  number: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <p className="text-xs font-bold tracking-[0.2em] text-muted-foreground">SECTION {number}</p>
      <h2 className="mt-1 text-2xl font-bold tracking-tight text-navy sm:text-3xl">{title}</h2>
      {subtitle ? <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p> : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}
```

- [ ] **Step 3: 6개 호출부에 번호 채우기**

`ReportPage`의 `<div className="mt-10 space-y-16">` 안, 6개 `<Section ...>` 호출부를 각각 수정:

```tsx
          <Section number="01" title="통계" subtitle="이 자리에서 먼저 확인할 핵심 지표">
          ...
          <Section number="02" title="종합 분석" subtitle="운영 이력과 상권 데이터를 함께 해석했습니다">
          ...
          <Section number="03" title="주변 상권 분석" subtitle="주변 경쟁 환경을 시각적으로 정리했습니다">
          ...
          <Section number="04" title="위험도" subtitle="여러 신호를 종합한 참고용 등급">
          ...
          <Section number="05" title="운영 이력" subtitle="이 자리를 거쳐간 업종의 시간 흐름입니다.">
          ...
          <Section number="06" title="계약 체크리스트" subtitle="계약 전에 반드시 확인해야 하는 항목">
```

(각 `<Section>` 태그의 여는 부분만 교체하고 나머지 자식/닫는 태그는 그대로 둔다.)

- [ ] **Step 4: `RiskCard`를 그라데이션 바 + 5단계 범례로 교체**

파일 상단 import에 `RISK_LABELS` 추가:

```ts
import { ApiRequestError, buildUnitAnalysis, findOccupant, isOccupiedStatus } from "@/lib/api";
import type { RiskLevel, Tenancy, UnitAnalysis, UnitDetail } from "@/lib/api";
```

교체 (`RISK_LABELS`도 함께 import):

```ts
import {
  ApiRequestError,
  buildUnitAnalysis,
  findOccupant,
  isOccupiedStatus,
  RISK_LABELS,
} from "@/lib/api";
import type { RiskLevel, Tenancy, UnitAnalysis, UnitDetail } from "@/lib/api";
```

`RiskCard` 함수 전체를 교체 (`RISK_BAR_CLASS` 상수는 더 이상 안 쓰므로 삭제):

```tsx
function RiskCard({ level, label }: { level: RiskLevel; label: string }) {
  // 세그먼트 중앙(각 1/5 구간의 가운데)에 현재 단계 마커를 둔다.
  const markerPct = ((level - 0.5) / 5) * 100;
  return (
    <Card className="rounded-2xl border-border/70 bg-surface p-8 shadow-card">
      <div className="grid gap-8 lg:grid-cols-[auto_1fr] lg:items-center">
        <div className="text-center">
          <RiskBadge level={level} label={label} />
          <p className="mt-3 text-xs tabular-nums text-muted-foreground">Level {level} / 5</p>
        </div>
        <div>
          <div className="relative">
            <div
              className="h-2 overflow-hidden rounded-full"
              style={{
                background:
                  "linear-gradient(to right, color-mix(in oklch, var(--color-brand) 55%, white), color-mix(in oklch, var(--color-warn) 55%, white), color-mix(in oklch, var(--color-danger) 55%, white))",
              }}
            />
            <div
              aria-hidden
              className="absolute -top-1 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-surface bg-navy shadow-card"
              style={{ left: `${markerPct}%` }}
            />
          </div>
          <div className="mt-3 grid grid-cols-5 text-center text-[11px] text-muted-foreground">
            {([1, 2, 3, 4, 5] as RiskLevel[]).map((l) => (
              <span key={l} className={l === level ? "font-bold text-navy" : ""}>
                {RISK_LABELS[l]}
              </span>
            ))}
          </div>
          <p className="mt-6 text-sm leading-relaxed text-foreground">
            이 자리에서 관측된 폐업 횟수, 평균 생존기간, 반복 실패 신호를 종합한 참고용 등급입니다.
            실제 창업 결정은 업종·자본·운영 전략과 함께 판단하세요.
          </p>
        </div>
      </div>
    </Card>
  );
}
```

`riskToneOf`는 `SummaryGrid`의 `RiskBadge` 등 다른 곳에서 여전히 쓰이므로 import는 그대로 둔다(삭제하지 말 것 — `riskToneOf` 자체는 `risk-badge.tsx`에서 import, `RISK_BAR_CLASS`만 이 파일에서 삭제 대상).

- [ ] **Step 5: `TimelineCard`를 가로 스크롤 스트립으로 교체**

파일 상단 import를 확인해 `useState` 옆에 `useRef`를 추가:

```ts
import { useRef, useState } from "react";
```

`EdgeScroller` import 추가:

```ts
import { EdgeScroller } from "@/components/edge-scroller";
```

`TimelineCard` 함수 전체를 교체 (아래 `selected` 이후의 상세 카드 블록은 그대로 유지 — 목록 부분만 교체):

```tsx
function TimelineCard({ timeline }: { timeline: Tenancy[] }) {
  const [selectedId, setSelectedId] = useState(
    () => findOccupant(timeline)?.tenancyId ?? timeline[timeline.length - 1]?.tenancyId ?? "",
  );
  const selected =
    timeline.find((t) => t.tenancyId === selectedId) ?? timeline[timeline.length - 1];
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-border/70 bg-surface p-4 shadow-card sm:p-6">
        <EdgeScroller scrollRef={scrollRef} deps={[timeline.length]}>
          <div
            ref={scrollRef}
            className="no-scrollbar relative flex gap-3 overflow-x-auto px-1 py-2"
          >
            {/* 카드 뒤 연결선. 화면마다 정확한 위치는 다를 수 있어 Playwright로
                점(StatusDot) 중심과 어긋나는지 확인 후 top 값을 조정할 것. */}
            <div aria-hidden className="absolute inset-x-1 top-[25px] h-px bg-border" />
            {timeline.map((t) => {
              const displayCategory = t.industryDetail ?? t.subCategory;
              return (
                <button
                  key={t.tenancyId}
                  type="button"
                  onClick={() => setSelectedId(t.tenancyId)}
                  className={
                    "relative z-10 flex w-40 shrink-0 flex-col items-start gap-1.5 rounded-xl p-3 text-left transition hover:bg-secondary/40 " +
                    (t.tenancyId === selectedId ? "bg-secondary/50" : "")
                  }
                >
                  <StatusDot status={t.status} />
                  <span className="w-full truncate text-sm font-semibold text-navy">
                    {t.businessName}
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {t.licensedAt.slice(0, 7)} — {t.closedAt ? t.closedAt.slice(0, 7) : "현재"}
                  </span>
                  <span className="w-full truncate text-xs text-muted-foreground">
                    {displayCategory}
                  </span>
                </button>
              );
            })}
          </div>
        </EdgeScroller>
      </Card>

      {selected && (
        <Card className="rounded-2xl border-border/70 bg-surface p-6 shadow-card sm:p-8">
```

(이 지점부터 파일 끝 `TimelineCard`의 나머지 부분 — 상세 카드 내용 전체 — 은 기존 그대로 유지한다. `<ul className="divide-y divide-border">...</ul>`로 시작하던 옛 세로 목록 블록만 위 가로 스크롤 블록으로 대체된 것.)

`StatusDot` 함수 위 주석 중 "이 span은 flex 컨테이너의 직접 자식이 아니라..." 부분은 이제 새 레이아웃에서 `StatusDot`이 `flex flex-col` 버튼의 직접 자식이라 더 이상 사실이 아니다 — 주석을 삭제한다(코드는 그대로 두되, `inline-block` 클래스도 이제 불필요하지만 부작용 없이 남겨둬도 무방하므로 굳이 지우지 않는다):

```tsx
// 폐업/취소/말소 등 영업·휴업이 아닌 모든 상태는 빈 원(○)으로 통일 —
// isOccupiedStatus()와 같은 기준(CLAUDE.md "알려진 스펙-실측 차이" 참고).
function StatusDot({ status }: { status: Tenancy["status"] }) {
```

- [ ] **Step 6: 타입 확인**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 7: Playwright로 시각 검증**

`.env.local`을 임시로 실배포 API로 전환 후 `/report/:storeId`(demo 유닛 id) 방문:
- SECTION 01~06 라벨이 각 섹션 제목 위에 보이는지
- 위험도 바가 그라데이션(원색이 아닌 muted 톤)인지, 마커가 현재 레벨 위치에 있는지, 5단계 라벨 중 현재 단계만 굵게 보이는지
- 운영 이력이 가로 스크롤 카드 스트립으로 보이는지, 연결선이 점(StatusDot)과 시각적으로 어긋나면 `top-[25px]` 값을 조정
- 이력이 8개 이상인 유닛(mock-data 중 `sn-123-4-1-101` 등)에서 EdgeScroller 화살표/페이드가 나타나고 클릭 시 스크롤되는지
검증 후 `.env.local` 원복.

- [ ] **Step 8: 커밋**

```bash
git add src/routes/report.\$storeId.tsx src/lib/api/unit-analysis.ts src/lib/api/client.ts
git commit -m "feat: 리포트 페이지에 SECTION 번호, 위험도 그라데이션 범례, 가로 스크롤 타임라인 적용"
```

---

## Task 5: Pretendard 폰트 실제 로드

**Files:**
- Modify: `src/styles.css`

**Interfaces:** 없음 — 전역 CSS 한 줄 추가, 다른 태스크와 무관.

- [ ] **Step 1: CDN import 추가**

`src/styles.css` 맨 첫 줄(현재 `@import "tailwindcss" source(none);`) 앞에 추가:

```css
@import url("https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css");
@import "tailwindcss" source(none);
@source "../src";
@import "tw-animate-css";
```

(참조 레포 `D:\Dev\_Woowahan-Techcourse\woowaTon\client\src\index.css`가 실제로 쓰는 것과 동일한 URL — 사용자가 지정한 기준점.)

- [ ] **Step 2: 빌드 확인**

Run: `npx vite build --mode development` 또는 `npm run dev`로 기동 후 브라우저에서 네트워크 탭에 `pretendard.min.css` 200 응답이 오는지 확인. (이 샌드박스 환경이 외부 CDN을 막고 있다면 Naver 지도와 같은 종류의 "이 환경 한계"로 보고 — 코드 자체는 문제 없으니 그대로 진행. Railway/Vercel 배포 후 재확인 필요하다고 커밋 메시지에 남긴다.)

- [ ] **Step 3: 커밋**

```bash
git add src/styles.css
git commit -m "fix: Pretendard 폰트를 선언만 하고 실제로 로드하지 않던 문제 수정"
```

---

## Task 6: 지도 페이지 기준 디자인 일원화

**Files:**
- Modify: `src/components/site-header.tsx`
- Modify: `src/components/site-footer.tsx`
- Modify: `src/routes/search.tsx` (버튼 한 곳)
- Modify: `src/routes/index.tsx` (두 곳)

**Interfaces:** 없음 — 전부 className 교체, 시그니처 변경 없음.

- [ ] **Step 1: `SiteHeader`의 floating 표면을 지도 페이지 브랜드 블록과 맞추기**

`src/components/site-header.tsx` 전체 교체:

```tsx
import { Link } from "@tanstack/react-router";

// 기본은 sticky(문서 흐름 안에서 64px를 차지) — report/search 등 일반 스크롤
// 페이지는 이 공간이 있어야 본문이 헤더 밑에 깔리지 않는다. 랜딩의 풀페이지
// 스크롤 스냅에서만 흐름 공간을 아예 없애야 각 섹션이 정확히 100dvh를 채우므로
// floating=true로 position: fixed를 쓴다. floating 표면은 검색 페이지의
// 플로팅 브랜드 블록(surface/90 + shadow-lg + blur)과 같은 언어를 쓴다 —
// sticky는 일반 독(dock) 내비게이션이라 계속 border-b만 쓴다.
export function SiteHeader({ floating = false }: { floating?: boolean }) {
  return (
    <header
      className={
        "inset-x-0 top-0 z-30 backdrop-blur " +
        (floating
          ? "fixed bg-surface/90 shadow-lg"
          : "sticky border-b border-border/60 bg-background/80")
      }
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-navy text-navy-foreground text-sm font-semibold">
            터
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="text-[15px] font-semibold tracking-tight text-foreground">터봄</span>
            <span className="text-xs text-muted-foreground">Turbohm</span>
          </span>
        </Link>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: `SiteFooter`의 floating 표면 토큰만 맞추기**

`src/components/site-footer.tsx`에서 `floating` 분기의 `className`:

```tsx
      <footer className="fixed inset-x-0 bottom-0 z-20 h-8 border-t border-border/60 bg-background/80 text-[11px] text-muted-foreground backdrop-blur">
```

교체 (surface 토큰만 통일, 두께/그림자는 그대로 — 8px 얇은 바에 그림자를 더하면 부자연스러움):

```tsx
      <footer className="fixed inset-x-0 bottom-0 z-20 h-8 border-t border-border/60 bg-surface/90 text-[11px] text-muted-foreground backdrop-blur">
```

- [ ] **Step 3: `search.tsx` 검색 제출 버튼 모양 통일**

기존:

```tsx
            <button
              type="submit"
              className="shrink-0 rounded-xl bg-navy px-3.5 py-1.5 text-sm font-bold text-navy-foreground transition hover:brightness-110"
            >
              검색
            </button>
```

교체:

```tsx
            <button
              type="submit"
              className="shrink-0 rounded-full bg-navy px-3.5 py-1.5 text-sm font-bold text-navy-foreground transition hover:brightness-110"
            >
              검색
            </button>
```

- [ ] **Step 4: `index.tsx` — 소제목 굵기 통일**

`PreviewReportCard` 안:

```tsx
        <h3 className="text-xl font-semibold text-navy">1층 102호 · 상가 리포트</h3>
```

교체:

```tsx
        <h3 className="text-xl font-extrabold text-navy">1층 102호 · 상가 리포트</h3>
```

- [ ] **Step 5: `index.tsx` — `WhyTurbohm` 카드 패딩을 앱 전체 스케일(p-8이 다른 곳에 전혀 없음)에 맞추기**

```tsx
            <Card
              key={c.no}
              className="rounded-2xl border-border/70 bg-surface p-4 shadow-card sm:p-8"
            >
```

교체:

```tsx
            <Card
              key={c.no}
              className="rounded-2xl border-border/70 bg-surface p-4 shadow-card sm:p-6"
            >
```

- [ ] **Step 6: 타입 확인**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 7: Playwright로 시각 검증**

`.env.local`을 임시 전환 후 랜딩(`/`)·검색(`/search?q=...`)·리포트(`/report/:id`) 3화면 스크린샷:
- 랜딩 히어로의 플로팅 헤더가 검색 페이지 브랜드 블록과 같은 표면(블러+그림자)으로 보이는지
- 검색 페이지 제출 버튼이 다른 버튼들과 같은 pill 모양인지
- `WhyTurbohm` 카드 패딩이 과하게 커 보이지 않는지
검증 후 `.env.local` 원복.

- [ ] **Step 8: 커밋**

```bash
git add src/components/site-header.tsx src/components/site-footer.tsx src/routes/search.tsx src/routes/index.tsx
git commit -m "style: 지도 페이지 표면/버튼/굵기 기준으로 헤더·랜딩 디자인 일원화"
```

---

## 최종 검증 (모든 태스크 완료 후)

- [ ] `npx tsc --noEmit && npx vitest run` 전체 통과 확인 (Task 1 이전 대비 테스트 수 증가분: site-markers +2, edge-scroll +4 신규 = 총 6개 증가)
- [ ] `git status --short`로 `package-lock.json` 외 워킹트리가 깨끗한지 확인
- [ ] `.env.local`이 원래 값(데모 모드)으로 복원돼 있는지 확인
- [ ] `docs/spec/api-spec.md`/`docs/spec/frontend-spec.md`가 이 계획 실행 중 수정되지 않았는지 `git diff`로 확인
