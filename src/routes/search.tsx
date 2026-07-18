import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { AlertTriangle, ChevronRight, List, MapPin, Search as SearchIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EdgeScroller } from "@/components/edge-scroller";
import { DEMO_ADDRESSES } from "@/lib/mock-data";
import { isDemoMode } from "@/lib/api";
import type { UnitSummary } from "@/lib/api";
import { useSiteDetail, useSiteSearch } from "@/hooks/use-sites";
import { MapView, type ViewportBounds } from "@/components/map-view";
import {
  administrativePrefixOf,
  buildSiteMarkers,
  dongCandidateCounts,
  extractLotLabel,
} from "@/lib/site-markers";
import { ReportView } from "@/routes/report.$storeId";

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";

const floorSortValue = (label: string) => {
  const floorMatch = label.match(/(-?\d+)\s*층/);
  if (!floorMatch) return Number.MAX_SAFE_INTEGER;
  return Number(floorMatch[1]);
};

const unitSortValue = (label: string) => {
  const unitMatch = label.match(/(\d+)\s*호/);
  if (!unitMatch) return Number.MAX_SAFE_INTEGER;
  return Number(unitMatch[1]);
};

const inferredFloorSortValue = (label: string) => {
  const explicitFloor = floorSortValue(label);
  if (explicitFloor !== Number.MAX_SAFE_INTEGER) return explicitFloor;

  const unit = unitSortValue(label);
  if (unit === Number.MAX_SAFE_INTEGER) return Number.MAX_SAFE_INTEGER;

  if (unit >= 1000) return Math.floor(unit / 100);
  if (unit >= 100) return Math.floor(unit / 100);
  return 0;
};

const displayUnitLabel = (label: string) => {
  if (label.match(/-?\d+\s*층/)) return label;
  const inferredFloor = inferredFloorSortValue(label);
  if (inferredFloor === Number.MAX_SAFE_INTEGER) return label;
  return `${inferredFloor}층 ${label}`;
};

// 물건 목록 행 3번째 줄 왼쪽(평균 운영기간). UnitSummary엔 "현재 입주자가
// 지금까지 운영한 기간"이 없다(그 값은 물건 상세의 Tenancy.survivalMonths에만
// 있고, 이 목록 API는 averageSurvivalMonths—전체 이력 평균—만 준다) — 그래서
// "영업 기간"은 averageSurvivalMonths로 표시한다. industryDetail은 1번째
// 줄의 상태 배지 옆으로 옮겨서 여기서는 빼고, 3번째 줄은 평균 운영기간만 남긴다.
const unitDetailLine = (u: UnitSummary): string =>
  u.averageSurvivalMonths != null ? `평균 ${u.averageSurvivalMonths}개월` : "-";

// 3번째 줄 오른쪽(개업·폐업 횟수). closedCount가 totalTenancyCount를 넘는
// 경우는 없지만(폐업도 입점의 부분집합), 방어적으로 음수는 만들지 않는다.
const unitOpenCloseLine = (u: UnitSummary): string =>
  `개업 ${u.totalTenancyCount} · 폐업 ${u.closedCount}`;

const searchSchema = z.object({
  q: z.string().optional().catch(""),
  // 예전엔 jibunAddress 문자열을 저장했는데, 같은 jibunAddress 텍스트를 공유하는
  // 서로 다른 pnu가 실제로 존재한다(실측 2026-07-18, 금토동 534-8 — 산 지번과
  // 일반 지번이 "산" 표기 없이 같은 텍스트로 내려옴, 백엔드 이슈). jibunAddress를
  // 식별자로 쓰면 이런 경우 두 후보를 구분할 수 없어(항상 첫 번째만 찾아짐) pnu로
  // 바꿨다 — pnu는 후보마다 항상 고유하다.
  pnu: z.string().optional().catch(""),
  // 물건 상세로 "이동"하는 대신 이 값이 채워지면 검색 화면 위에 리포트를
  // 오버레이로 띄운다 — 뒤로가기를 누르면 이 파라미터만 사라지고 검색
  // 화면(SearchPage)은 그대로 마운트돼 있던 상태라 스크롤/지도 위치/필터가
  // 그대로 보존된다(예전엔 /report/$storeId로 라우트 자체를 이동해 검색
  // 화면이 통째로 언마운트됐다가 뒤로가기 시 처음부터 다시 그려졌다).
  unit: z.string().optional().catch(""),
  demo: z.boolean().optional().catch(false),
});

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "자리 분석 · 터봄" },
      {
        name: "description",
        content: "지번 주소로 동일 지번 내 모든 상가와 층·호를 확인하고 리포트를 확인하세요.",
      },
    ],
  }),
  validateSearch: searchSchema,
  component: SearchPage,
});

function SearchPage() {
  const { q = "", pnu = "", unit = "" } = Route.useSearch();
  const navigate = useNavigate();
  const [input, setInput] = useState(q);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => setInput(q), [q]);

  const searchQuery = useSiteSearch(q);
  // searchQuery.data는 react-query가 쿼리키(q)당 캐싱하는 안정적인 참조라, 타이핑
  // 중(input state 변화)에는 바뀌지 않는다 — candidates/markers를 이 값에 대해서만
  // useMemo로 묶어야 SearchPage가 리렌더될 때마다 MapView의 마커 이펙트가
  // 불필요하게(마커 전부 재생성 + fitBounds 재계산) 재실행되는 걸 막을 수 있다.
  // 반경(m)/개수 캡으로 후보를 미리 자르지 않는다 — 근사 중심점(전체 후보 좌표
  // 평균) 기준 고정 반경은 동/구처럼 넓이가 들쭉날쭉한 검색어에 안 맞는다(좁은
  // 동은 다 묻히고 넓은 동은 그래도 넘침, 2026-07-17 금토동 실측: 71개 중 4개만
  // 300m 안에 남음). 대신 전체 후보를 그대로 지도에 fitBounds시키고(지도가
  // 검색 범위에 맞춰 알아서 확대/축소), 마커 밀집은 MapView의 클러스터링이,
  // 패널 목록 노출은 아래 뷰포트 필터(visibleCandidates)가 각각 맡는다.
  const candidates = useMemo(() => searchQuery.data?.candidates ?? [], [searchQuery.data]);
  // `구` 단위처럼 넓은 검색어로 결과가 여러 동에 걸치면(distinct 동 2개 이상)
  // 지번 탭/패널 대신 동 선택 화면을 먼저 보여준다 — Task 2의 뷰포트 필터보다
  // 앞선 게이트라 candidates(전체) 기준으로만 판단한다.
  const dongCounts = useMemo(() => dongCandidateCounts(candidates), [candidates]);
  const needsDongSelection = dongCounts.size >= 2;

  const activePnu = pnu || candidates[0]?.pnu || "";
  const activeCandidate = candidates.find((c) => c.pnu === activePnu) ?? candidates[0];
  const siteDetailQuery = useSiteDetail(activeCandidate?.pnu);
  const markers = useMemo(
    () => buildSiteMarkers(candidates, q, activeCandidate?.pnu),
    [candidates, q, activeCandidate?.pnu],
  );

  // 지도→패널 단방향 흐름: 지도가 idle에서 보고하는 화면 범위를 패널의 지번
  // 탭 목록에만 한 겹 더 걸러 쓴다. 마커/activeCandidate는 계속 candidates
  // 그대로라 이 state가 바뀌어도 지도의 센터/줌은 다시 움직이지 않는다(무한
  // 루프 방지 — 상세 설계는 map-view.tsx의 idle 리스너 주석 참고).
  const [viewportBounds, setViewportBounds] = useState<ViewportBounds | null>(null);
  // 새 검색 결과가 오면(q 변경) 지도가 아직 안 움직였을 수 있으니 필터 없이
  // 시작한다 — 그러지 않으면 이전 검색의 뷰포트가 새 후보에 그대로 적용돼
  // 패널이 비어 보일 수 있다.
  useEffect(() => setViewportBounds(null), [q]);
  const visibleCandidates = useMemo(() => {
    if (!viewportBounds) return candidates;
    return candidates.filter((c) => {
      if (c.latitude == null || c.longitude == null) return true; // 좌표 없으면 판단 불가 — 통과
      return (
        c.latitude >= viewportBounds.south &&
        c.latitude <= viewportBounds.north &&
        c.longitude >= viewportBounds.west &&
        c.longitude <= viewportBounds.east
      );
    });
  }, [candidates, viewportBounds]);

  const submit = (query: string) => {
    if (!query.trim()) return;
    navigate({ to: "/search", search: { q: query.trim() } });
  };

  const selectSite = (p: string) => {
    navigate({ to: "/search", search: { q, pnu: p } });
    setCollapsed(false);
  };

  const goToReport = (storeId: string) => {
    navigate({ to: "/search", search: { q, pnu, unit: storeId } });
  };

  return (
    <div className="fixed inset-0">
      <MapView
        className="h-full w-full"
        onMarkerClick={selectSite}
        onBackgroundClick={() => setCollapsed(true)}
        onViewportChange={setViewportBounds}
        markers={markers}
      />

      {/* 플로팅 UI — 지도 위에 겹치는 부분만 pointer-events-auto로 클릭 가능하게 한다 */}
      <div className="pointer-events-none absolute inset-0 z-[1000] flex flex-col p-4 sm:p-5">
        <div className="pointer-events-auto flex w-full max-w-[420px] items-center gap-3 transition-all duration-300 focus-within:max-w-[640px]">
          <Link
            to="/"
            className="flex shrink-0 items-center gap-2.5 rounded-xl bg-surface/90 px-3 py-2 shadow-elevated backdrop-blur transition"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand text-sm font-black text-brand-foreground">
              터
            </span>
            <span className="hidden leading-tight sm:block">
              <span className="block text-[15px] font-extrabold tracking-tight text-navy">
                터봄
              </span>
              <span className="block text-[11px] font-extrabold tracking-[0.18em] text-muted-foreground">
                TURBOHM
              </span>
            </span>
          </Link>
          <form
            className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border/70 bg-surface/95 p-1.5 shadow-elevated backdrop-blur"
            onSubmit={(e) => {
              e.preventDefault();
              submit(input);
            }}
          >
            <SearchIcon className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="지번 주소로 검색"
              className="w-full min-w-0 bg-transparent py-1.5 text-sm text-navy placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              className="shrink-0 rounded-xl bg-navy px-3.5 py-1.5 text-sm font-bold text-navy-foreground transition hover:brightness-110 active:scale-[0.98]"
            >
              검색
            </button>
          </form>
        </div>

        <div className="flex min-h-0 flex-1 flex-col sm:mt-4">
          <aside
            onClickCapture={
              collapsed
                ? (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCollapsed(false);
                  }
                : undefined
            }
            className={
              "pointer-events-auto mt-auto flex max-h-[58dvh] w-full flex-col overflow-hidden rounded-xl border border-border/70 bg-surface/95 shadow-elevated backdrop-blur transition-transform duration-300 ease-out sm:mt-0 sm:max-h-full sm:w-[420px] " +
              (collapsed
                ? "translate-y-[calc(100%-18px)] cursor-pointer sm:-translate-x-[calc(100%-18px)] sm:translate-y-0"
                : "")
            }
          >
            {!q ? (
              <EmptyState onDemo={(addr) => submit(addr)} />
            ) : searchQuery.isLoading ? (
              <SearchSkeleton />
            ) : searchQuery.isError ? (
              <ErrorState
                message={errorMessage(searchQuery.error)}
                onRetry={() => searchQuery.refetch()}
              />
            ) : candidates.length === 0 ? (
              <NoResults query={q} />
            ) : needsDongSelection ? (
              <DongPicker
                query={q}
                counts={dongCounts}
                // 기존 검색어 뒤에 그냥 이어붙이지 않는다 — 시/구 접두어만
                // 남기고 그 뒤(이미 있었을 동/지번 등)는 버린 뒤 선택한
                // 동으로 새로 교체한다(이유: site-markers.ts의
                // administrativePrefixOf 주석 참고).
                onSelect={(dong) => {
                  const prefix = administrativePrefixOf(q);
                  submit(prefix ? `${prefix} ${dong}` : dong);
                }}
              />
            ) : (
              <>
                {candidates.length > 1 && (
                  <div className="border-b border-border/60 p-3">
                    {visibleCandidates.length > 0 ? (
                      <SegmentedTabs
                        key={q}
                        items={visibleCandidates.map((c) => ({
                          // id는 반드시 pnu — jibunAddress 텍스트는 서로 다른
                          // pnu가 우연히 같은 문자열을 공유할 수 있어(예: 산
                          // 지번과 일반 지번이 "산" 표기 없이 동일 텍스트로
                          // 내려오는 백엔드 이슈, 2026-07-18 실측 금토동
                          // 534-8) 식별자로 못 쓴다. 라벨 텍스트 자체가
                          // 똑같아 보이는 건 이 문제의 눈에 보이는 증상일 뿐,
                          // 탭을 눌렀을 때 실제로 다른 자리로 전환되는지는
                          // pnu 기반 id/activeId로 보장한다.
                          id: c.pnu,
                          label: extractLotLabel(c.jibunAddress, q),
                        }))}
                        activeId={activeCandidate?.pnu ?? ""}
                        onChange={selectSite}
                      />
                    ) : (
                      <p className="px-1 py-1.5 text-xs text-muted-foreground">
                        지도를 움직이면 이 지역의 다른 자리를 확인할 수 있습니다.
                      </p>
                    )}
                  </div>
                )}

                <div className="border-b border-border/60 px-5 py-4">
                  <p className="text-xs font-semibold text-muted-foreground">지금 보고 있는 자리</p>
                  <p className="mt-1 truncate text-lg font-extrabold text-navy">
                    {activeCandidate?.jibunAddress}
                  </p>
                  {/* 도로명주소가 없는(null) 실측 응답이 있다 — 내용 유무와
                      무관하게 h-5로 고정해 자리 전환 시 패널 높이가 안 흔들리게 */}
                  <p className="mt-0.5 h-5 truncate text-sm text-muted-foreground">
                    {activeCandidate?.roadAddress}
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <Pill>점포 {activeCandidate?.unitCount}개</Pill>
                    <Pill tone="danger">폐업 이력 {activeCandidate?.closedCount}건</Pill>
                    {activeCandidate?.currentSubCategory && (
                      <Pill>{activeCandidate.currentSubCategory}</Pill>
                    )}
                  </div>
                  {/* 좌표 유무와 무관하게 항상 자리를 예약 — 자리 전환마다 이
                      문구가 나타났다 사라졌다 하며 패널 높이가 흔들리지 않게 */}
                  <p className="mt-2 h-4 text-xs text-muted-foreground">
                    {activeCandidate?.latitude == null
                      ? "이 자리는 위치 정보가 없어 지도에 표시할 수 없습니다."
                      : ""}
                  </p>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                  {/* 로딩/에러/빈 목록/실제 목록 어느 상태든 항상 같은 자리에
                      떠 있도록 분기 바깥으로 뺐다 — 자리 전환마다 이 줄이
                      나타났다 사라지며 패널이 흔들리는 걸 막는다. */}
                  <p className="px-2 text-xs font-semibold text-muted-foreground">
                    궁금한 점포를 누르면 보고서가 생성돼요
                  </p>
                  <div className="mt-3">
                    {siteDetailQuery.isLoading ? (
                      <UnitListSkeleton />
                    ) : siteDetailQuery.isError ? (
                      <ErrorState
                        message={errorMessage(siteDetailQuery.error)}
                        onRetry={() => siteDetailQuery.refetch()}
                      />
                    ) : (
                      <UnitList units={siteDetailQuery.data?.units ?? []} onSelect={goToReport} />
                    )}
                  </div>
                </div>

                {siteDetailQuery.data && (
                  <div className="border-t border-border/60 px-5 py-3 text-xs text-muted-foreground">
                    <p className="font-semibold text-navy">
                      기준일 {siteDetailQuery.data.disclaimer.dataAsOf}
                    </p>
                    <p className="mt-0.5">{siteDetailQuery.data.disclaimer.note}</p>
                  </div>
                )}
              </>
            )}
          </aside>
        </div>

        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="pointer-events-auto absolute bottom-6 left-4 flex items-center gap-2 rounded-lg bg-navy px-4 py-2.5 text-sm font-bold text-navy-foreground shadow-elevated transition hover:bg-navy/90 active:scale-[0.98] sm:left-5"
          >
            <List className="h-4 w-4" />
            점포 목록
          </button>
        )}
      </div>

      {unit && (
        <ReportOverlay
          key={unit}
          storeId={unit}
          onClose={() => navigate({ to: "/search", search: { q, pnu } })}
        />
      )}
    </div>
  );
}

// 검색 화면을 언마운트하지 않고 그 위에 새로 띄우는 리포트 패널 — 닫으면
// (X 버튼 또는 브라우저 뒤로가기, 둘 다 결과적으로 search 파라미터의 unit이
// 사라지는 것) 이 컴포넌트만 사라지고 아래 깔려있던 SearchPage는 계속
// 마운트된 채로 남아있던 상태 그대로 다시 보인다.
function ReportOverlay({ storeId, onClose }: { storeId: string; onClose: () => void }) {
  return (
    <div className="cover-slide fixed inset-0 z-[2000] flex flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between border-b border-border/70 bg-surface/95 px-4 py-3 shadow-elevated backdrop-blur">
        <span className="text-sm font-bold text-navy">자리 리포트</span>
        <button
          onClick={onClose}
          className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-navy"
          aria-label="닫기"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ReportView storeId={storeId} />
      </div>
    </div>
  );
}

function EmptyState({ onDemo }: { onDemo: (addr: string) => void }) {
  return (
    <div className="p-8 text-center">
      <MapPin className="mx-auto h-8 w-8 text-brand" />
      <h2 className="mt-4 text-lg font-semibold text-navy">지번 주소로 검색을 시작하세요</h2>
      <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
        본번까지 입력하시면 해당 지번의 모든 상가와 층·호수를 보여드립니다.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {DEMO_ADDRESSES.map((a) => (
          <button
            key={a}
            onClick={() => onDemo(a)}
            className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-navy transition hover:border-brand/50 hover:bg-brand-soft"
          >
            {a}
          </button>
        ))}
      </div>
    </div>
  );
}

function NoResults({ query }: { query: string }) {
  return (
    <div className="p-8 text-center">
      <h2 className="text-lg font-semibold text-navy">"{query}" 결과가 없습니다</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {isDemoMode
          ? "데모 모드에서는 아래 세 개 지번만 지원합니다."
          : "다른 지번 주소로 다시 검색해보세요."}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {DEMO_ADDRESSES.map((a) => (
          <Link
            key={a}
            to="/search"
            search={{ q: a }}
            className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-navy transition hover:border-brand/50 hover:bg-brand-soft"
          >
            {a}
          </Link>
        ))}
      </div>
    </div>
  );
}

// "구" 단위 검색처럼 결과가 여러 동에 걸칠 때 지번 탭/패널 대신 먼저 보여주는
// 화면 — 동을 고르면 onSelect(호출부에서 시/구 접두어 + 선택한 동으로 검색어를
// 새로 구성해 재검색)를 통해 좁힌다.
function DongPicker({
  query,
  counts,
  onSelect,
}: {
  query: string;
  counts: Map<string, number>;
  onSelect: (dong: string) => void;
}) {
  return (
    <div className="p-6 text-center">
      <MapPin className="mx-auto h-8 w-8 text-brand" />
      <h2 className="mt-4 text-lg font-semibold text-navy">"{query}"에 여러 동의 결과가 있어요</h2>
      <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
        동을 선택하면 해당 동으로 좁혀 다시 검색합니다.
      </p>
      <ul className="mt-5 space-y-2">
        {[...counts.entries()].map(([dong, count]) => (
          <li key={dong}>
            <button
              onClick={() => onSelect(dong)}
              className="flex w-full items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-left text-sm font-semibold text-navy transition hover:border-brand/50 hover:bg-brand-soft"
            >
              <span>{dong}</span>
              <span className="text-xs font-normal text-muted-foreground">{count}개 자리</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="p-8 text-center">
      <AlertTriangle className="mx-auto h-8 w-8 text-danger" />
      <h2 className="mt-4 text-base font-semibold text-navy">불러오는 중 문제가 발생했습니다</h2>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" className="mt-5 rounded-lg" onClick={onRetry}>
        다시 시도
      </Button>
    </div>
  );
}

// 자리 후보 선택 — 고정 배경색 스왑 대신 라디오그룹처럼 슬라이딩 하이라이트가
// 활성 탭을 따라가게 한다(참고 저장소 지도 페이지의 SegmentedTabs 이식).
// 검색어가 넓으면(예: 동 이름만) 후보가 수십~수백 개로 불어날 수 있다 — 탭을
// 전부 늘어놓지 않고 처음엔 적당한 개수만 보여준 뒤 "+N개 더"로 펼친다.
const MAX_VISIBLE_TABS = 8;

function SegmentedTabs({
  items,
  activeId,
  onChange,
}: {
  items: { id: string; label: string }[];
  activeId: string;
  onChange: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);
  const [expanded, setExpanded] = useState(false);

  const showAll = expanded || items.length <= MAX_VISIBLE_TABS;
  const visibleItems = showAll ? items : items.slice(0, MAX_VISIBLE_TABS);
  // 현재 선택된 후보가 잘려나간 뒤쪽에 있으면(예: 지도에서 직접 마커 클릭)
  // 마지막 자리를 양보해서라도 항상 보이게 한다.
  if (!showAll && !visibleItems.some((it) => it.id === activeId)) {
    const active = items.find((it) => it.id === activeId);
    if (active) visibleItems.splice(-1, 1, active);
  }
  const hiddenCount = items.length - visibleItems.length;

  useEffect(() => {
    const el = containerRef.current?.querySelector<HTMLElement>(
      `[data-id="${CSS.escape(activeId)}"]`,
    );
    if (el) setThumb({ left: el.offsetLeft, width: el.offsetWidth });
  }, [activeId, items.length, expanded]);

  return (
    <div className="flex items-center gap-1.5">
      <EdgeScroller
        scrollRef={containerRef}
        deps={[visibleItems.length]}
        fadeClassName="from-secondary"
      >
        <div
          ref={containerRef}
          role="radiogroup"
          className="no-scrollbar relative flex min-w-0 flex-1 gap-1 overflow-x-auto rounded-full bg-secondary p-1"
        >
          {thumb && (
            <span
              aria-hidden
              className="absolute inset-y-1 rounded-full bg-navy transition-[left,width] duration-300 ease-out"
              style={{ left: thumb.left, width: thumb.width }}
            />
          )}
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
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="shrink-0 whitespace-nowrap rounded-full bg-secondary px-3 py-1.5 text-sm font-semibold text-brand hover:text-navy"
        >
          +{hiddenCount}
        </button>
      )}
    </div>
  );
}

// 채워진 배지 대신 흰 배경 + 테두리의 옅은 필 — 데이터 칩이 너무 튀지 않게.
function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "danger";
}) {
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full border bg-surface px-2.5 py-1 text-xs font-semibold shadow-card " +
        (tone === "danger" ? "border-danger/25 text-danger" : "border-border text-navy")
      }
    >
      {children}
    </span>
  );
}

// 상태 표기 — 채워진 배지 대신 색 점 + 텍스트만(색으로만 구분하지 않도록 항상
// 텍스트를 함께 노출).
const STATUS_DOT_CLASS: Record<UnitSummary["currentStatus"], string> = {
  영업: "bg-brand",
  공실: "bg-muted-foreground/50",
};

function StatusBadge({ status }: { status: UnitSummary["currentStatus"] }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-navy/80">
      <span className={"h-1.5 w-1.5 shrink-0 rounded-full " + STATUS_DOT_CLASS[status]} />
      {status}
    </span>
  );
}

function UnitList({
  units,
  onSelect,
}: {
  units: UnitSummary[];
  onSelect: (storeId: string) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<"all" | "영업" | "공실">("all");
  // 자리 전환 시 이 자리에 등록된 점포가 0개일 수 있다 — 조용히 아무것도 안
  // 보여주면 패널 본문이 통째로 사라져 높이가 흔들린다. 안내 문구로 자리를
  // 채워 항상 비슷한 골격을 유지한다.
  if (!units.length) {
    return (
      <p className="px-2 py-1.5 text-xs text-muted-foreground">
        이 자리엔 등록된 점포 정보가 없습니다.
      </p>
    );
  }
  const sortedUnits = [...units]
    .filter((u) => statusFilter === "all" || u.currentStatus === statusFilter)
    .sort((a, b) => {
      const floorDiff = inferredFloorSortValue(a.label) - inferredFloorSortValue(b.label);
      if (floorDiff !== 0) return floorDiff;
      const unitDiff = unitSortValue(a.label) - unitSortValue(b.label);
      if (unitDiff !== 0) return unitDiff;
      return a.label.localeCompare(b.label, "ko-KR");
    });

  return (
    <div className="space-y-3">
      <div className="flex justify-end px-2">
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            if (value === "all" || value === "영업" || value === "공실") setStatusFilter(value);
          }}
        >
          <SelectTrigger className="h-8 w-[100px] rounded-full border-border bg-surface text-xs text-navy shadow-none">
            <SelectValue placeholder="필터" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">모두</SelectItem>
            <SelectItem value="영업">영업</SelectItem>
            <SelectItem value="공실">공실</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <ul className="space-y-2">
        {sortedUnits.map((u) => (
          <li key={u.unitId}>
            <button
              onClick={() => onSelect(u.unitId)}
              style={{
                borderLeftColor:
                  u.currentStatus === "영업" ? "var(--color-brand)" : "var(--color-border)",
              }}
              className="grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-border/70 border-l-4 bg-surface p-3.5 text-left transition hover:shadow-elevated"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-bold text-navy">{displayUnitLabel(u.label)}</span>
                  <StatusBadge status={u.currentStatus} />
                  {/* 업종(industryDetail)은 상가API 보강에 의존해 신뢰도가 낮아
                      목록에서는 배제 — 항상 신뢰 가능한 개폐업 이력으로 채운다. */}
                  {u.closedCount > 0 && (
                    <span className="max-w-[110px] truncate rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-danger uppercase">
                      폐업 {u.closedCount}회
                    </span>
                  )}
                </div>
                {/* 2·3번째 줄은 내용이 없어도 고정 높이(h-5/h-4)로 항상 자리를
                    예약한다 — 그러지 않으면 점포명·업종 유무에 따라 공실/영업
                    카드 높이가 서로 달라진다. */}
                <p className="mt-1 h-5 truncate text-sm font-semibold text-navy">
                  {u.currentStatus === "영업" && u.currentBusinessName ? u.currentBusinessName : ""}
                </p>
                <div className="mt-1.5 flex h-4 items-center justify-between gap-2">
                  <p className="truncate text-xs text-muted-foreground">{unitDetailLine(u)}</p>
                  <p className="shrink-0 text-xs text-muted-foreground">{unitOpenCloseLine(u)}</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SearchSkeleton() {
  return (
    <div className="space-y-3 p-3">
      <Skeleton className="h-9 w-40 rounded-full" />
      <Skeleton className="h-20 rounded-xl" />
      <Skeleton className="h-20 rounded-xl" />
    </div>
  );
}

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
