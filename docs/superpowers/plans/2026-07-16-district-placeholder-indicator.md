# 업종 구성/경쟁도 목업 데이터 "예시" 표시 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 상가API 보강 미동작으로 항상 노출되는 업종 구성/경쟁도/전체 점포 수 목업 데이터를, 기존 `TimelineCard`의 "예시" Badge/칩 패턴을 재사용해 시각적으로 구분되게 만든다.

**Architecture:** `src/lib/api/unit-analysis.ts`의 `buildUnitAnalysis`가 이미 계산 중인 "폴백 사용 여부" 조건을 `district.isPlaceholder: boolean` 필드로 노출하고, `src/routes/report.$storeId.tsx`의 `DistrictAnalysis`가 이 플래그를 읽어 카드 헤더 2곳에 `Badge`("예시"), `StatRow` 한 곳에 인라인 칩, 컴포넌트 하단에 캡션 한 줄을 추가한다. 새 컴포넌트·새 시각 언어 없이 기존 3개 패턴만 재사용한다.

**Tech Stack:** React 18 + TypeScript + TanStack Router + Tailwind CSS v4 + Vitest. 새 npm 의존성 없음.

## Global Constraints

- `FALLBACK_COMPOSITION`/`FALLBACK_TOTAL_STORES` 목업 데이터 자체는 제거하거나 "정보 없음"으로 바꾸지 않는다 — 표시만 구분한다(설계 문서 확정 사항).
- `StatRow`/`MarketRow` 두 컴포넌트를 하나로 합치는 리팩터는 하지 않는다 — `StatRow`에 optional prop 하나만 추가.
- `docs/spec/api-spec.md`/`docs/spec/frontend-spec.md`는 서버 레포 미러라 수정하지 않는다(`CLAUDE.md` §2).
- 새 npm 패키지를 추가하지 않는다.
- 각 태스크 종료 시 `npx tsc --noEmit`이 0 errors여야 한다.
- Task 1(순수 로직)은 TDD로 진행한다 — 이 레포의 `src/lib/api/tenancy.test.ts`/`src/lib/geo.test.ts` 컨벤션과 동일. Task 2(라우트 컴포넌트, JSX-only)는 이 레포에 라우트 컴포넌트 유닛테스트 관례가 없으므로 타입 체크 + 브라우저 확인으로 검증한다(`docs/superpowers/plans/2026-07-14-content-layout-refresh.md` Task 4/6과 동일한 관례).

---

## Task 1: `UnitAnalysis.district.isPlaceholder` 추가

**Files:**
- Modify: `src/lib/api/unit-analysis.ts:41-54` (interface), `:64-69` (주석), `:88-123` (계산 로직)
- Test: `src/lib/api/unit-analysis.test.ts` (신규)

**Interfaces:**
- Consumes: 없음 (기존 `buildUnitAnalysis(detail: UnitDetail): UnitAnalysis` 시그니처 그대로)
- Produces: `UnitAnalysis.district.isPlaceholder: boolean` — Task 2가 이 필드를 `report.$storeId.tsx`에서 읽는다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/api/unit-analysis.test.ts` 신규 작성:

```ts
import { describe, expect, it } from "vitest";
import { buildUnitAnalysis } from "./unit-analysis";
import type { Tenancy, UnitDetail } from "./types";

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
    asOf: "2026-07-16",
    totalStoreCount: null,
    categoryBreakdown: null,
  },
  ...overrides,
});

const baseDetail = (timeline: Tenancy[]): UnitDetail => ({
  unit: {
    unitId: "u-1",
    label: "1층 101호",
    jibunAddress: "경기도 성남시 수정구 신흥동 123-4",
    roadAddress: "경기도 성남시 수정구 산성대로1번길 1",
    parsedFloor: null,
    parsedUnitNo: null,
    parseConfidence: null,
  },
  statistics: {
    totalTenancyCount: timeline.length,
    closedCount: timeline.filter((t) => t.status === "폐업").length,
    averageSurvivalMonths: 24,
    longestSurvivalMonths: 36,
    shortestSurvivalMonths: 12,
  },
  timeline,
  disclaimer: { dataAsOf: "2026-07-16", note: "" },
});

describe("buildUnitAnalysis district.isPlaceholder", () => {
  it("is true when there is no current occupant to read marketInfo from", () => {
    const detail = baseDetail([baseTenancy({ status: "폐업", closedAt: "2020-06-01" })]);
    expect(buildUnitAnalysis(detail).district.isPlaceholder).toBe(true);
  });

  it("is true when the occupant's marketInfo.categoryBreakdown is null", () => {
    const detail = baseDetail([baseTenancy({ status: "영업" })]);
    expect(buildUnitAnalysis(detail).district.isPlaceholder).toBe(true);
  });

  it("is true when categoryBreakdown is an empty array", () => {
    const detail = baseDetail([
      baseTenancy({
        status: "영업",
        marketInfo: {
          isPlaceholder: false,
          leaseAreaSqm: null,
          depositKrw: null,
          monthlyRentKrw: null,
          keyMoneyKrw: null,
          dailyFloatingPopulation: null,
          sameCategoryNearbyCount: 3,
          vacancyRatePercent: null,
          asOf: "2026-07-16",
          totalStoreCount: 120,
          categoryBreakdown: [],
        },
      }),
    ]);
    expect(buildUnitAnalysis(detail).district.isPlaceholder).toBe(true);
  });

  it("is false when the occupant has real categoryBreakdown data", () => {
    const detail = baseDetail([
      baseTenancy({
        status: "영업",
        marketInfo: {
          isPlaceholder: false,
          leaseAreaSqm: null,
          depositKrw: null,
          monthlyRentKrw: null,
          keyMoneyKrw: null,
          dailyFloatingPopulation: null,
          sameCategoryNearbyCount: 3,
          vacancyRatePercent: null,
          asOf: "2026-07-16",
          totalStoreCount: 120,
          categoryBreakdown: [{ code: "Q01", name: "음식점", count: 50, ratio: 0.4 }],
        },
      }),
    ]);
    expect(buildUnitAnalysis(detail).district.isPlaceholder).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/lib/api/unit-analysis.test.ts`
Expected: FAIL — `district.isPlaceholder`가 `undefined`라 `toBe(true)`/`toBe(false)` 단언이 전부 실패.

- [ ] **Step 3: `UnitAnalysis` 인터페이스에 필드 추가**

`src/lib/api/unit-analysis.ts:41-54`, 기존:

```ts
export interface UnitAnalysis {
  riskLevel: RiskLevel;
  riskLabel: string;
  narrative: string[];
  district: {
    composition: { category: string; count: number; ratio: number }[];
    stats: {
      sameCategory: number | null;
      totalStores: number;
      referenceDate: string;
    };
  };
  checklist: { key: string; label: string }[];
}
```

교체:

```ts
export interface UnitAnalysis {
  riskLevel: RiskLevel;
  riskLabel: string;
  narrative: string[];
  district: {
    composition: { category: string; count: number; ratio: number }[];
    // categoryBreakdown이 비어 있어(상가API 보강 미동작 등) FALLBACK_* 목업으로
    // 대체됐는지 여부 — report.$storeId.tsx의 DistrictAnalysis가 이 값으로
    // "예시" Badge/칩 표시 여부를 결정한다.
    isPlaceholder: boolean;
    stats: {
      sameCategory: number | null;
      totalStores: number;
      referenceDate: string;
    };
  };
  checklist: { key: string; label: string }[];
}
```

- [ ] **Step 4: 상단 주석 갱신 (2026-07-10 확정 서술을 07-16 실측에 맞게 정정)**

`src/lib/api/unit-analysis.ts:64-69`, 기존:

```ts
// district.composition/totalStores used to be 100% static demo numbers
// (same on every report). The backend's marketInfo now includes real
// categoryBreakdown/totalStoreCount (confirmed 2026-07-10), so those are
// used when present. Falls back to the old static demo numbers only when
// absent — mock mode (legacy-adapter.ts never sets these) or a vacant unit
// with no current occupant to read marketInfo from.
```

교체:

```ts
// district.composition/totalStores read real data from marketInfo
// (categoryBreakdown/totalStoreCount) when present, falling back to the
// static demo numbers below otherwise. In practice the real branch is
// rarely taken: 2026-07-16 실측(CLAUDE.md "알려진 스펙-실측 차이" 참고)
// 확인 결과 상가API 보강 파이프라인이 실배포에서 100% 미동작이라
// categoryBreakdown이 항상 비어 있다 — 그래서 사실상 항상 아래
// FALLBACK_* 목업으로 대체된다. isPlaceholder가 이 폴백 여부를
// report.$storeId.tsx의 DistrictAnalysis에 알리는 신호다.
```

- [ ] **Step 5: 계산 로직에 `isPlaceholder` 추가**

`src/lib/api/unit-analysis.ts:88-98`, 기존:

```ts
  const categoryBreakdown = current?.marketInfo.categoryBreakdown;
  const composition =
    categoryBreakdown && categoryBreakdown.length > 0
      ? categoryBreakdown.map((c) => ({ category: c.name, count: c.count, ratio: c.ratio }))
      : FALLBACK_COMPOSITION.map((c) => ({
          ...c,
          ratio: FALLBACK_TOTAL_STORES > 0 ? c.count / FALLBACK_TOTAL_STORES : 0,
        }));
```

교체:

```ts
  const categoryBreakdown = current?.marketInfo.categoryBreakdown;
  const isPlaceholder = !(categoryBreakdown && categoryBreakdown.length > 0);
  const composition = !isPlaceholder
    ? categoryBreakdown!.map((c) => ({ category: c.name, count: c.count, ratio: c.ratio }))
    : FALLBACK_COMPOSITION.map((c) => ({
        ...c,
        ratio: FALLBACK_TOTAL_STORES > 0 ? c.count / FALLBACK_TOTAL_STORES : 0,
      }));
```

그리고 같은 파일의 `return` 블록(`district:` 부분), 기존:

```ts
    district: {
      composition,
      stats: {
        sameCategory: sameCategoryCount,
        totalStores,
        referenceDate,
      },
    },
```

교체:

```ts
    district: {
      composition,
      isPlaceholder,
      stats: {
        sameCategory: sameCategoryCount,
        totalStores,
        referenceDate,
      },
    },
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx vitest run src/lib/api/unit-analysis.test.ts`
Expected: PASS (4/4)

- [ ] **Step 7: 전체 테스트 + 타입 확인**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 errors, 전체 테스트 PASS (기존 35개 + 신규 4개 = 39개)

- [ ] **Step 8: 커밋**

```bash
git add src/lib/api/unit-analysis.ts src/lib/api/unit-analysis.test.ts
git commit -m "feat: UnitAnalysis.district에 isPlaceholder 플래그 추가"
```

---

## Task 2: `DistrictAnalysis`에 "예시" 표시 3곳 적용

**Files:**
- Modify: `src/routes/report.$storeId.tsx:323-451` (`DistrictAnalysis`, `StatRow`)

**Interfaces:**
- Consumes: Task 1의 `UnitAnalysis["district"].isPlaceholder`(이미 `DistrictAnalysis`가 받는 `district` prop 안에 포함되어 있음 — import 변경 없음).
- Produces: 없음 (다른 태스크가 이 컴포넌트를 참조하지 않음).

- [ ] **Step 1: `DistrictAnalysis`에서 `isPlaceholder` 구조분해 추가**

`src/routes/report.$storeId.tsx:323-327`, 기존:

```tsx
function DistrictAnalysis({ district }: { district: UnitAnalysis["district"] }) {
  const { composition, stats } = district;
  const [selectedCategory, setSelectedCategory] = useState(() => composition[0] ?? null);
  const max = Math.max(...composition.map((c) => c.count));
  const competitionScore = selectedCategory ? Math.round(selectedCategory.ratio * 100) : 0;
```

교체:

```tsx
function DistrictAnalysis({ district }: { district: UnitAnalysis["district"] }) {
  const { composition, isPlaceholder, stats } = district;
  const [selectedCategory, setSelectedCategory] = useState(() => composition[0] ?? null);
  const max = Math.max(...composition.map((c) => c.count));
  const competitionScore = selectedCategory ? Math.round(selectedCategory.ratio * 100) : 0;
```

- [ ] **Step 2: "업종 구성" 카드 헤더에 예시 Badge 추가**

`src/routes/report.$storeId.tsx:330-334`, 기존:

```tsx
      <Card className="rounded-xl border-border/70 bg-surface p-6 shadow-card">
        <div className="flex items-baseline justify-between">
          <h3 className="text-base font-semibold text-navy">업종 구성</h3>
          <span className="text-xs text-muted-foreground">반경 300m · 업종별 점포 수</span>
        </div>
```

교체:

```tsx
      <Card className="rounded-xl border-border/70 bg-surface p-6 shadow-card">
        <div className="flex items-baseline justify-between">
          <h3 className="text-base font-semibold text-navy">업종 구성</h3>
          <div className="flex items-center gap-2">
            {isPlaceholder && (
              <Badge
                variant="outline"
                className="rounded-full border-border text-[10px] text-muted-foreground"
              >
                예시
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">반경 300m · 업종별 점포 수</span>
          </div>
        </div>
```

- [ ] **Step 3: "경쟁도" 카드 헤더에 예시 Badge 추가**

`src/routes/report.$storeId.tsx:366-403`, 기존 (`Card` 전체):

```tsx
        <Card className="rounded-xl border-border/70 bg-surface p-6 shadow-card">
          <div className="flex items-baseline justify-between">
            <h3 className="text-base font-semibold text-navy">경쟁도</h3>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 rounded-full border-border/70 px-3 text-xs text-muted-foreground"
                >
                  {selectedCategory?.category ?? "업종 선택"}
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-auto max-w-[320px] p-3">
                <div className="flex flex-wrap gap-2">
                  {composition.map((c) => {
                    const active = selectedCategory?.category === c.category;
                    return (
                      <button
                        key={c.category}
                        type="button"
                        onClick={() => setSelectedCategory(c)}
                        className={
                          "rounded-full px-3 py-1.5 text-xs transition " +
                          (active
                            ? "bg-navy text-navy-foreground"
                            : "border border-border bg-surface text-muted-foreground hover:border-brand/40 hover:text-navy")
                        }
                      >
                        {c.category}
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>
```

교체 (Badge를 담을 `<div className="flex items-center gap-2">`로 `Popover`를 감싼다 — 나머지 `Popover` 내부는 글자 하나 안 바뀜):

```tsx
        <Card className="rounded-xl border-border/70 bg-surface p-6 shadow-card">
          <div className="flex items-baseline justify-between">
            <h3 className="text-base font-semibold text-navy">경쟁도</h3>
            <div className="flex items-center gap-2">
              {isPlaceholder && (
                <Badge
                  variant="outline"
                  className="rounded-full border-border text-[10px] text-muted-foreground"
                >
                  예시
                </Badge>
              )}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 rounded-full border-border/70 px-3 text-xs text-muted-foreground"
                  >
                    {selectedCategory?.category ?? "업종 선택"}
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-auto max-w-[320px] p-3">
                  <div className="flex flex-wrap gap-2">
                    {composition.map((c) => {
                      const active = selectedCategory?.category === c.category;
                      return (
                        <button
                          key={c.category}
                          type="button"
                          onClick={() => setSelectedCategory(c)}
                          className={
                            "rounded-full px-3 py-1.5 text-xs transition " +
                            (active
                              ? "bg-navy text-navy-foreground"
                              : "border border-border bg-surface text-muted-foreground hover:border-brand/40 hover:text-navy")
                          }
                        >
                          {c.category}
                        </button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
```

- [ ] **Step 4: `StatRow`에 `placeholder` prop 추가**

`src/routes/report.$storeId.tsx:444-451`, 기존:

```tsx
function StatRow({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className="mt-0.5 text-base font-semibold tabular-nums text-navy">{v}</dd>
    </div>
  );
}
```

교체:

```tsx
function StatRow({ k, v, placeholder }: { k: string; v: string; placeholder?: boolean }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {k}
        {placeholder && (
          <span className="rounded border border-border px-1 text-[9px] text-muted-foreground">
            예시
          </span>
        )}
      </dt>
      <dd className="mt-0.5 text-base font-semibold tabular-nums text-navy">{v}</dd>
    </div>
  );
}
```

이 컴포넌트는 `DistrictAnalysis`와 `TimelineCard` 양쪽에서 쓰인다 — `placeholder`가 optional이라 `TimelineCard`의 기존 6개 호출부(`<StatRow k="상호" .../>` 등)는 값을 안 넘기므로 그대로 동작한다(변경 없음).

- [ ] **Step 5: "전체 점포" 행에만 `placeholder` 전달**

`src/routes/report.$storeId.tsx:425-429`, 기존:

```tsx
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <StatRow k="동일 업종" v={String(stats.sameCategory ?? 0)} />
            <StatRow k="전체 점포" v={String(stats.totalStores)} />
            <StatRow k="집계 기준일" v={stats.referenceDate} />
          </dl>
```

교체:

```tsx
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <StatRow k="동일 업종" v={String(stats.sameCategory ?? 0)} />
            <StatRow k="전체 점포" v={String(stats.totalStores)} placeholder={isPlaceholder} />
            <StatRow k="집계 기준일" v={stats.referenceDate} />
          </dl>
```

- [ ] **Step 6: 컴포넌트 하단에 캡션 추가**

`DistrictAnalysis`의 `return`은 최상위 `<div className="grid ...">` 하나뿐이다(Step 1~5로는 안 바뀜). 이 `return`의 시작과 끝, 두 곳을 각각 수정한다 — 가운데(두 `Card`/`div`의 내용)는 Step 1~5에서 이미 수정한 그대로 손대지 않는다.

**시작 부분** — `src/routes/report.$storeId.tsx:328` 부근, 기존:

```tsx
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
```

교체 (바깥 `<div>` 하나 추가):

```tsx
  return (
    <div>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
```

**끝 부분** — `src/routes/report.$storeId.tsx:430-434` 부근, 기존:

```tsx
        </Card>
      </div>
    </div>
  );
}
```

교체 (기존 두 `</div>`—`space-y-4`/`grid` 닫힘—뒤에 캡션과 위 "시작 부분"에서 새로 연 바깥 `<div>`의 닫힘을 추가):

```tsx
        </Card>
      </div>
    </div>
      {isPlaceholder && (
        <p className="mt-3 text-xs text-muted-foreground">실 데이터 연동 전 예시값입니다.</p>
      )}
    </div>
  );
}
```

(들여쓰기는 위 두 조각을 그대로 붙여넣은 뒤 `prettier`가 정리한다 — 다음 스텝에서 `eslint --fix`로 재확인.)

- [ ] **Step 7: 타입/포맷 확인**

Run: `npx tsc --noEmit && npx eslint src/routes/report.\$storeId.tsx --fix`
Expected: 0 errors.

- [ ] **Step 8: 전체 테스트 확인**

Run: `npx vitest run`
Expected: 전체 PASS (39개, Task 1에서 늘어난 개수 유지 — 이 태스크는 신규 테스트 없음).

- [ ] **Step 9: 브라우저로 시각 검증**

`.env.local`이 이미 실배포 API(`VITE_API_BASE_URL=https://turbom.duckdns.org`)를 가리키고 있는지 확인 후 `npm run dev`, `/report/:storeId`(아무 실제 unitId, 예: 검색 페이지에서 지번 검색 후 점포 클릭) 방문:
- "업종 구성"/"경쟁도" 카드 헤더 오른쪽에 "예시" Badge가 보이는지
- "상권 통계" 카드의 "전체 점포" 행에만 작은 "예시" 칩이 붙고 "동일 업종"/"집계 기준일"엔 안 붙는지
- 카드 그리드 아래 "실 데이터 연동 전 예시값입니다." 캡션이 한 번만 보이는지
- 현재(2026-07-16 기준) 상가API 보강이 100% 미동작이므로 어떤 물건을 봐도 위 3가지가 전부 보여야 정상 — 만약 안 보이면 `isPlaceholder` 계산이 잘못된 것이니 Task 1을 재확인

- [ ] **Step 10: 커밋**

```bash
git add src/routes/report.\$storeId.tsx
git commit -m "feat: 업종 구성/경쟁도/전체 점포 수에 예시 데이터 표시 추가"
```

---

## 최종 검증 (모든 태스크 완료 후)

- [ ] `npx tsc --noEmit && npx vitest run` 전체 통과 (총 39개 테스트: 기존 35 + Task 1 신규 4)
- [ ] `git status --short`로 워킹트리가 깨끗한지 확인 (untracked `package-lock.json`/`skills-lock.json`/`.agents/`/`.claude/`는 이 계획과 무관하니 그대로 둔다)
- [ ] `docs/spec/api-spec.md`/`docs/spec/frontend-spec.md`가 이 계획 실행 중 수정되지 않았는지 `git diff`로 확인
