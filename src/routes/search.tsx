import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import type { Candidate, UnitSummary } from "@/lib/api";
import { useSiteDetail, useSiteSearch } from "@/hooks/use-sites";
import { MapView } from "@/components/map-view";

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
  const candidates = searchQuery.data?.candidates ?? [];
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
        <div className="pointer-events-auto flex w-full max-w-[330px] items-center gap-3 transition-all duration-300 focus-within:max-w-[620px]">
          <Link
            to="/"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-navy text-navy-foreground shadow-lg transition hover:brightness-110"
          >
            <span className="text-sm font-semibold">터</span>
          </Link>
          <form
            className="relative min-w-0 flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              submit(input);
            }}
          >
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="지번 주소로 검색"
              className="h-11 w-full rounded-2xl border border-border/70 bg-surface/95 pl-11 pr-4 text-sm shadow-lg backdrop-blur outline-none focus-visible:ring-2 focus-visible:ring-brand"
            />
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
                    <JibunTabs
                      candidates={candidates}
                      activeJibun={activeCandidate?.jibunAddress ?? ""}
                      query={q}
                      onSelect={selectJibun}
                    />
                  </div>
                )}

                <div className="border-b border-border/60 px-5 py-4">
                  <p className="text-xs font-medium text-muted-foreground">지금 보고 있는 자리</p>
                  <p className="mt-1 truncate text-lg font-semibold text-navy">
                    {activeCandidate?.jibunAddress}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {activeCandidate?.roadAddress}
                  </p>
                  <div className="mt-2.5 flex gap-2 text-xs font-medium">
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-navy">
                      점포 {activeCandidate?.unitCount}개
                    </span>
                    <span className="rounded-full bg-warn-soft px-2.5 py-1 text-warn">
                      폐업 이력 {activeCandidate?.closedCount}건
                    </span>
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

function JibunTabs({
  candidates,
  activeJibun,
  query,
  onSelect,
}: {
  candidates: Candidate[];
  activeJibun: string;
  query: string;
  onSelect: (jibun: string) => void;
}) {
  return (
    <div className="max-h-[108px] overflow-y-auto pr-1">
      <div className="grid grid-cols-5 gap-2">
        {candidates.map((c) => {
          const active = c.jibunAddress === activeJibun;
          return (
            <button
              key={c.pnu}
              onClick={() => onSelect(c.jibunAddress)}
              className={
                "rounded-full px-3 py-1.5 text-xs transition " +
                (active
                  ? "bg-navy text-navy-foreground"
                  : "border border-border bg-surface text-navy hover:border-brand/40")
              }
            >
              {extractLotLabel(c.jibunAddress, query)}
            </button>
          );
        })}
      </div>
    </div>
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
              className="flex w-full items-center gap-3 rounded-xl border border-border/70 bg-surface p-3.5 text-left shadow-card transition hover:bg-surface-muted/60 hover:shadow-elevated"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={
                      "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium " +
                      (u.currentStatus === "영업"
                        ? "bg-brand-soft text-navy"
                        : "bg-secondary text-muted-foreground")
                    }
                  >
                    <span
                      className={
                        "mr-1.5 h-1.5 w-1.5 rounded-full " +
                        (u.currentStatus === "영업" ? "bg-brand" : "bg-muted-foreground/50")
                      }
                    />
                    <span>{u.currentStatus}</span>
                  </span>
                  <span className="text-sm font-semibold text-navy">
                    {displayUnitLabel(u.label)}
                  </span>
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
