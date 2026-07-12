import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { AlertTriangle, ChevronRight, List, MapPin, Search as SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { DEMO_ADDRESSES } from "@/lib/mock-data";
import { isDemoMode } from "@/lib/api";
import type { UnitSummary } from "@/lib/api";
import { useSiteDetail, useSiteSearch } from "@/hooks/use-sites";
import { MapView } from "@/components/map-view";
import { withinRadius } from "@/lib/geo";

// 넓은 동/읍 이름만으로 검색하면 후보가 실제 관심 범위 밖까지 잡힐 수 있다 —
// 매칭된 후보들 좌표의 근사 중심점(withinRadius 참고) 기준 반경 300m로 좁힌다.
const SEARCH_RADIUS_METERS = 300;

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";

// jibunAddress는 "시/도 시/군/구 동 지번 [건물명] [층·호]" 형태로 건물명·층·호까지
// 이어붙어 있어서 마지막 토큰이 지번이라는 보장이 없다. 검색어에서 동/읍/면/리로
// 끝나는 토큰(행정동 이름)을 찾아 jibunAddress 안에서 그 위치를 앵커로 삼고,
// 바로 다음 토큰(지번)만 탭 라벨로 쓴다. 앵커를 못 찾으면 기존 방식(마지막 토큰)으로 폴백.
const DONG_SUFFIX = /(동|읍|면|리|가)$/;

const extractLotLabel = (jibunAddress: string, query: string): string => {
  const tokens = jibunAddress.trim().split(/\s+/);
  const queryTokens = query.trim().split(/\s+/).filter(Boolean);
  const dongToken = queryTokens
    .slice()
    .reverse()
    .find((t) => DONG_SUFFIX.test(t));
  if (dongToken) {
    const idx = tokens.findIndex((t) => t === dongToken);
    if (idx !== -1 && idx + 1 < tokens.length) return tokens[idx + 1];
  }
  return tokens[tokens.length - 1] ?? jibunAddress;
};

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

const searchSchema = z.object({
  q: z.string().optional().catch(""),
  jibun: z.string().optional().catch(""),
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
  const { q = "", jibun = "" } = Route.useSearch();
  const navigate = useNavigate();
  const [input, setInput] = useState(q);
  const [collapsed, setCollapsed] = useState(false);
  // 상세 화면으로 넘어갈 때 잠깐 덮는 커버(고정된 지도 레이아웃을 깨지 않도록
  // opacity/translate만 쓴다). 커버가 화면을 덮은 뒤에 실제 라우트를 이동한다.
  const [cover, setCover] = useState(false);

  useEffect(() => setInput(q), [q]);

  const searchQuery = useSiteSearch(q);
  const candidates = withinRadius(searchQuery.data?.candidates ?? [], SEARCH_RADIUS_METERS);
  const activeJibun = jibun || candidates[0]?.jibunAddress || "";
  const activeCandidate = candidates.find((c) => c.jibunAddress === activeJibun) ?? candidates[0];
  const siteDetailQuery = useSiteDetail(activeCandidate?.pnu);

  const submit = (query: string) => {
    if (!query.trim()) return;
    navigate({ to: "/search", search: { q: query.trim() } });
  };

  const selectJibun = (j: string) => {
    navigate({ to: "/search", search: { q, jibun: j } });
    setCollapsed(false);
  };

  const goToReport = (storeId: string) => {
    setCover(true);
    setTimeout(() => navigate({ to: "/report/$storeId", params: { storeId } }), 300);
  };

  return (
    <div className="fixed inset-0">
      <MapView
        className="h-full w-full"
        onMarkerClick={selectJibun}
        onBackgroundClick={() => setCollapsed(true)}
        markers={candidates
          .filter((c) => c.latitude != null && c.longitude != null)
          .map((c) => ({
            id: c.pnu,
            lat: c.latitude as number,
            lng: c.longitude as number,
            label: extractLotLabel(c.jibunAddress, q),
            jibunAddress: c.jibunAddress,
            active: c.jibunAddress === activeCandidate?.jibunAddress,
          }))}
      />

      {/* 플로팅 UI — 지도 위에 겹치는 부분만 pointer-events-auto로 클릭 가능하게 한다 */}
      <div className="pointer-events-none absolute inset-0 z-[1000] flex flex-col p-4 sm:p-5">
        <div className="pointer-events-auto flex w-full max-w-[360px] items-center gap-3 transition-all duration-300 focus-within:max-w-[640px]">
          <Link
            to="/"
            className="flex shrink-0 items-center gap-2.5 rounded-2xl bg-surface/90 px-3 py-2 shadow-lg backdrop-blur transition hover:shadow-xl"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand text-sm font-black text-brand-foreground">
              터
            </span>
            <span className="hidden leading-tight sm:block">
              <span className="block text-[15px] font-extrabold tracking-tight text-navy">
                터봄
              </span>
              <span className="block text-[10px] font-bold tracking-[0.22em] text-muted-foreground">
                TURBOHM
              </span>
            </span>
          </Link>
          <form
            className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-border/70 bg-surface/95 p-1.5 shadow-lg backdrop-blur"
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
              className="w-full min-w-0 bg-transparent py-1.5 text-sm text-navy outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              className="shrink-0 rounded-xl bg-navy px-3.5 py-1.5 text-sm font-bold text-navy-foreground transition hover:brightness-110"
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
              "pointer-events-auto mt-auto flex max-h-[58dvh] w-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-surface/95 shadow-2xl backdrop-blur transition-transform duration-300 ease-out sm:mt-0 sm:max-h-full sm:w-[420px] " +
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
            ) : (
              <>
                {candidates.length > 1 && (
                  <div className="border-b border-border/60 p-3">
                    <SegmentedTabs
                      key={q}
                      items={candidates.map((c) => ({
                        id: c.jibunAddress,
                        label: extractLotLabel(c.jibunAddress, q),
                      }))}
                      activeId={activeCandidate?.jibunAddress ?? ""}
                      onChange={selectJibun}
                    />
                  </div>
                )}

                <div className="border-b border-border/60 px-5 py-4">
                  <p className="text-xs font-semibold text-muted-foreground">지금 보고 있는 자리</p>
                  <p className="mt-1 truncate text-lg font-extrabold text-navy">
                    {activeCandidate?.jibunAddress}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {activeCandidate?.roadAddress}
                  </p>
                  <div className="mt-2.5 flex gap-2">
                    <Pill>점포 {activeCandidate?.unitCount}개</Pill>
                    <Pill tone="danger">폐업 이력 {activeCandidate?.closedCount}건</Pill>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                  {siteDetailQuery.isLoading ? (
                    <UnitListSkeleton />
                  ) : siteDetailQuery.isError ? (
                    <ErrorState
                      message={errorMessage(siteDetailQuery.error)}
                      onRetry={() => siteDetailQuery.refetch()}
                    />
                  ) : (
                    <UnitList
                      units={siteDetailQuery.data?.units ?? []}
                      jibunAddress={activeCandidate?.jibunAddress ?? ""}
                      onSelect={goToReport}
                    />
                  )}
                </div>

                {siteDetailQuery.data && (
                  <div className="border-t border-border/60 px-5 py-3 text-xs text-muted-foreground">
                    기준일 {siteDetailQuery.data.disclaimer.dataAsOf} ·{" "}
                    {siteDetailQuery.data.disclaimer.note}
                  </div>
                )}
              </>
            )}
          </aside>
        </div>

        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="pointer-events-auto absolute bottom-6 left-4 flex items-center gap-2 rounded-full bg-navy px-4 py-2.5 text-sm font-semibold text-navy-foreground shadow-xl transition hover:bg-navy/90 sm:left-5"
          >
            <List className="h-4 w-4" />
            점포 목록
          </button>
        )}
      </div>

      {cover && <div className="cover-slide fixed inset-0 z-[2000] bg-navy" />}
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

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="p-8 text-center">
      <AlertTriangle className="mx-auto h-8 w-8 text-danger" />
      <h2 className="mt-4 text-base font-semibold text-navy">불러오는 중 문제가 발생했습니다</h2>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" className="mt-5 rounded-full" onClick={onRetry}>
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
      <div
        ref={containerRef}
        role="radiogroup"
        className="relative flex min-w-0 flex-1 gap-1 overflow-x-auto rounded-full bg-secondary p-1"
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
  jibunAddress,
  onSelect,
}: {
  units: UnitSummary[];
  jibunAddress: string;
  onSelect: (storeId: string) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<"all" | "영업" | "공실">("all");
  if (!units.length) return null;
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
      <div className="flex flex-wrap items-center justify-between gap-3 px-2">
        <p className="text-xs font-medium text-muted-foreground">
          궁금한 점포를 누르면 보고서가 생성돼요
        </p>
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
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-extrabold text-navy">
                    {displayUnitLabel(u.label)}
                  </span>
                  <StatusBadge status={u.currentStatus} />
                  {u.currentStatus === "영업" && u.currentBusinessName ? (
                    <span className="text-sm font-semibold text-navy">{u.currentBusinessName}</span>
                  ) : null}
                </div>
                <p className="mt-1.5 line-clamp-1 text-xs text-muted-foreground">{jibunAddress}</p>
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
    <div className="space-y-2">
      <Skeleton className="h-16 rounded-xl" />
      <Skeleton className="h-16 rounded-xl" />
    </div>
  );
}
