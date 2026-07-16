# 업종 구성/경쟁도 목업 데이터 "예시" 표시 — 설계

## 배경

`src/lib/api/unit-analysis.ts`의 `buildUnitAnalysis`는 백엔드 `marketInfo.categoryBreakdown`이 비어 있으면 고정 목업(`FALLBACK_COMPOSITION`, 6개 카테고리·`FALLBACK_TOTAL_STORES=187`)으로 대체해 `district.composition`/`stats.totalStores`를 채운다. 이 폴백 자체는 의도된 설계(빈 화면보다 예시라도 보여주는 편이 낫다는 판단)지만, 화면에는 이 값이 실측인지 목업인지 구분하는 표시가 전혀 없다.

2026-07-16 실측(`CLAUDE.md` "알려진 스펙-실측 차이" §2)으로 상가API 보강 파이프라인이 배포 환경에서 **100% 미동작**임이 확인됐다 — 즉 지금 이 목업이 항상, 모든 물건에서 노출되고 있다는 뜻이다. 백엔드가 나중에 이 파이프라인을 고치거나 `units[]`에 `category`를 추가하면(둘 다 CLAUDE.md에 백엔드 작업으로 이미 기록됨) 목업 노출 빈도는 자연히 줄어든다 — 이번 작업은 그 근본 수정을 기다리지 않고, **목업이 실측처럼 보이는 현재 상태만 시각적으로 교정**한다.

같은 파일 안에서 이미 한 번 이 문제를 겪은 적이 있다: `sameCategoryNearbyCount`는 실데이터가 없으면 임의 숫자 대신 `null`로 두고 화면에서 "정보 없음"으로 정직하게 표시한다(주석 참고). `composition`/`totalStores`만 이 원칙에서 빠져 있었다.

## 채택 접근

`report.$storeId.tsx`의 `TimelineCard`(운영 이력 상세)가 이미 동일한 문제(`marketInfo.isPlaceholder`)를 겪고 있고, 두 가지 표시 패턴을 이미 구현해뒀다:

1. 카드 헤더에 `Badge`("예시") — 카드 전체가 목업일 때
2. `MarketRow`의 `real?: boolean` prop — 개별 필드 옆에 작은 "예시" 칩

이번 작업은 새 시각 언어를 만들지 않고 이 두 패턴을 `DistrictAnalysis`(업종 구성/경쟁도/상권 통계)에 그대로 이식한다.

## Task 1 — `UnitAnalysis.district.isPlaceholder` 추가

**File:** `src/lib/api/unit-analysis.ts`

- `district`에 `isPlaceholder: boolean` 필드 추가. 계산은 이미 존재하는 조건의 반대값 그대로: `!(categoryBreakdown && categoryBreakdown.length > 0)`.
- 상단 주석 중 "confirmed 2026-07-10"으로 실데이터 연동을 확정적으로 서술한 부분을, CLAUDE.md 07-16 실측(보강 100% 미동작)에 맞게 갱신 — "연동됐다"가 아니라 "연동되지만 실배포에서 관측되지 않는다"로 정정.

## Task 2 — `DistrictAnalysis`에 예시 표시 3곳 적용

**File:** `src/routes/report.$storeId.tsx`

- **업종 구성 카드**: 헤더의 `<span>반경 300m · 업종별 점포 수</span>` 옆에 `isPlaceholder`일 때 `Badge`("예시") 추가 (`TimelineCard`의 "시세 정보" 헤더와 동일한 마크업 재사용).
- **경쟁도 카드**: `competitionScore`가 같은 목업 `composition`의 `ratio`에서 계산되므로, 헤더(h3 "경쟁도" 옆, 기존 업종 선택 `Popover` 버튼과 나란히)에도 동일하게 `Badge`("예시") 추가.
- **상권 통계 카드**: `StatRow` 컴포넌트에 `placeholder?: boolean` prop 추가 — `MarketRow`의 기존 `!real` 칩과 동일한 마크업(`dt` 옆 작은 테두리 칩 "예시")을 재사용. "전체 점포" 행에만 `placeholder={district.isPlaceholder}` 전달 — "동일 업종"(`sameCategory`, 이미 null 폴백으로 정직 처리됨)과 "집계 기준일"은 대상 아님.
- **캡션 한 줄**: `isPlaceholder`일 때 `DistrictAnalysis`가 반환하는 `grid` 바깥, 컴포넌트 최하단에 전체 너비로 `TimelineCard`가 이미 쓰는 문구를 그대로 재사용 — "실 데이터 연동 전 예시값입니다." (업종 구성/경쟁도/상권 통계 3곳 모두에 걸리는 안내라 특정 카드 안이 아니라 컴포넌트 레벨에 한 번만 둔다.)

## 하지 않는 것 (명시적 스코프 제외)

- `FALLBACK_COMPOSITION`/`FALLBACK_TOTAL_STORES`를 제거하거나 "정보 없음"으로 바꾸는 것 — 사용자가 명시적으로 목업은 유지하고 표시만 구분하길 원함.
- `StatRow`/`MarketRow` 두 컴포넌트를 하나로 합치는 리팩터 — 이번 스코프 밖(기존에도 별도로 존재하던 중복이며, 이번 변경은 그중 하나에 prop 하나만 추가).
- `docs/spec/api-spec.md`/`frontend-spec.md` 수정 — 서버 레포 미러, `CLAUDE.md` §2에 따라 로컬에서 고치지 않음.
- 백엔드 보강 파이프라인·`units[].category` 자체를 고치는 것 — 둘 다 백엔드 작업으로 CLAUDE.md에 이미 기록됨, 이 스펙의 범위 밖.

## 검증 계획

- `src/lib/api/unit-analysis.test.ts` 신규 작성: `buildUnitAnalysis`가 `categoryBreakdown`이 없거나 빈 배열일 때 `district.isPlaceholder === true`, 실데이터가 있을 때 `false`를 반환하는지 확인 (레포 컨벤션상 순수 로직은 유닛테스트 필수 — `tenancy.test.ts`/`geo.test.ts`/`site-markers.test.ts`/`edge-scroll.test.ts`와 동일한 패턴).
- `npx tsc --noEmit && npx vitest run` 통과.
- 실배포 API(`.env.local`의 `VITE_API_BASE_URL`)로 `/report/:storeId` 방문해 "예시" Badge/칩/캡션이 실제로 보이는지 스크린샷 확인(현재 100% 목업 상태라 모든 물건에서 보여야 정상). 데모 유닛 중 실측 `categoryBreakdown`이 있는 케이스가 있다면 그 경우엔 표시가 사라지는지도 함께 확인.
