import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import {
  AlertTriangle,
  ChevronRight,
  List,
  MapPin,
  Search as SearchIcon,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
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
  const [panelOpen, setPanelOpen] = useState(true);
  const [searchFocused, setSearchFocused] = useState(false);

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

  const disclaimer = siteDetailQuery.data?.disclaimer;

  return (
    <div className="fixed inset-0 overflow-hidden bg-secondary/30">
      {/* 지도: 화면 전체 배경. 빈 곳 클릭 시 결과 패널을 접고/펴서 지도에 집중 */}
      <MapView
        className="absolute inset-0 h-full w-full"
        onMapClick={() => setPanelOpen((open) => !open)}
        onMarkerClick={(j) => navigate({ to: "/search", search: { q, jibun: j } })}
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

      {/* 상단 플로팅 바: 로고 pill + 검색 pill(포커스 시 확장) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center gap-3 p-4">
        <Link
          to="/"
          className="pointer-events-auto flex h-[52px] shrink-0 items-center gap-2.5 rounded-full bg-background px-4 shadow-elevated"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-navy text-sm font-semibold text-navy-foreground">
            터
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-foreground">터봄</span>
        </Link>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
          className={cn(
            "pointer-events-auto flex h-[52px] items-center gap-2 rounded-full bg-background py-1.5 pl-4 pr-1.5 shadow-elevated transition-all duration-300 ease-out",
            searchFocused ? "w-full max-w-3xl" : "w-[240px] sm:w-[340px]",
          )}
        >
          <SearchIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="예: 금토동 405"
            className="h-9 flex-1 border-0 bg-transparent px-2 text-base shadow-none focus-visible:ring-0"
          />
          <Button
            type="submit"
            className="h-10 shrink-0 rounded-full bg-navy px-6 text-navy-foreground hover:bg-navy/90"
          >
            검색
          </Button>
        </form>
      </div>

      {/* 왼쪽 플로팅 결과 패널: 지도 클릭 시 왼쪽으로 슬라이드 아웃 */}
      <aside
        className={cn(
          "absolute left-4 top-[84px] z-10 flex max-h-[calc(100%-104px)] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl bg-background shadow-elevated transition-transform duration-300 ease-out",
          panelOpen ? "translate-x-0" : "-translate-x-[calc(100%+1.5rem)]",
        )}
        aria-hidden={!panelOpen}
      >
        <div className="overflow-y-auto p-5">
          {!q ? (
            <EmptyState onDemo={submit} />
          ) : searchQuery.isLoading ? (
            <PanelSkeleton />
          ) : searchQuery.isError ? (
            <ErrorState
              message={errorMessage(searchQuery.error)}
              onRetry={() => searchQuery.refetch()}
            />
          ) : candidates.length === 0 ? (
            <NoResults query={q} />
          ) : (
            <div className="space-y-5">
              <JibunTabs
                candidates={candidates}
                activeJibun={activeCandidate?.jibunAddress ?? ""}
                query={q}
                onSelect={(j) => navigate({ to: "/search", search: { q, jibun: j } })}
              />

              <div>
                <p className="text-xs text-muted-foreground">지금 보고 있는 자리</p>
                <h2 className="mt-1.5 text-xl font-bold tracking-tight text-navy">
                  {activeCandidate?.jibunAddress}
                </h2>
                {activeCandidate?.roadAddress ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {activeCandidate.roadAddress}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-medium text-navy">
                    점포 {activeCandidate?.unitCount ?? 0}개
                  </span>
                  {activeCandidate?.closedCount ? (
                    <span className="rounded-lg border border-warn/30 bg-warn-soft px-2.5 py-1 text-xs font-medium text-navy">
                      폐업 이력 {activeCandidate.closedCount}건
                    </span>
                  ) : null}
                </div>
              </div>

              <hr className="border-border/60" />

              {siteDetailQuery.isLoading ? (
                <UnitListSkeleton />
              ) : siteDetailQuery.isError ? (
                <ErrorState
                  message={errorMessage(siteDetailQuery.error)}
                  onRetry={() => siteDetailQuery.refetch()}
                />
              ) : (
                <UnitList units={siteDetailQuery.data?.units ?? []} />
              )}

              {disclaimer ? (
                <>
                  <hr className="border-border/60" />
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    기준일 {disclaimer.dataAsOf} · {disclaimer.note}
                  </p>
                </>
              ) : null}
            </div>
          )}
        </div>
      </aside>

      {/* 패널이 접혀 있을 때 다시 여는 버튼 */}
      <button
        type="button"
        onClick={() => setPanelOpen(true)}
        className={cn(
          "absolute bottom-6 left-6 z-10 flex items-center gap-2 rounded-full bg-navy px-5 py-3.5 text-sm font-semibold text-navy-foreground shadow-elevated transition-all duration-300 hover:bg-navy/90",
          panelOpen ? "pointer-events-none translate-y-2 opacity-0" : "translate-y-0 opacity-100",
        )}
      >
        <List className="h-4 w-4" />
        점포 목록
      </button>
    </div>
  );
}

function EmptyState({ onDemo }: { onDemo: (addr: string) => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface-muted/40 p-6 text-center">
      <MapPin className="mx-auto h-7 w-7 text-brand" />
      <h2 className="mt-3 text-base font-semibold text-navy">지번 주소로 검색을 시작하세요</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        본번까지 입력하시면 해당 지번의 모든 상가와 층·호수를 보여드립니다.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-brand" />
        <span className="text-xs text-muted-foreground">데모 지번 바로가기</span>
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
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
    <div className="rounded-2xl border border-border bg-surface p-6 text-center">
      <h2 className="text-base font-semibold text-navy">"{query}" 결과가 없습니다</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
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
    <div className="rounded-2xl border border-danger/30 bg-surface p-6 text-center">
      <AlertTriangle className="mx-auto h-7 w-7 text-danger" />
      <h2 className="mt-3 text-base font-semibold text-navy">불러오는 중 문제가 발생했습니다</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">{message}</p>
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
  // 탭에는 "금토동 405-1"처럼 동 이름까지 붙여 표기(지도 핀 라벨은 지번만 유지)
  const dong = query
    .trim()
    .split(/\s+/)
    .reverse()
    .find((t) => DONG_SUFFIX.test(t));

  return (
    <div className="flex max-h-[96px] flex-wrap gap-1 overflow-y-auto rounded-2xl bg-secondary/60 p-1.5">
      {candidates.map((c) => {
        const active = c.jibunAddress === activeJibun;
        const lot = extractLotLabel(c.jibunAddress, query);
        return (
          <button
            key={c.pnu}
            onClick={() => onSelect(c.jibunAddress)}
            className={
              "rounded-full px-3.5 py-2 text-sm font-semibold transition " +
              (active
                ? "bg-navy text-navy-foreground shadow-sm"
                : "text-navy hover:bg-background/80")
            }
          >
            {dong ? `${dong} ${lot}` : lot}
          </button>
        );
      })}
    </div>
  );
}

const LOCATION_SOURCE_LABEL: Record<UnitSummary["locationSource"], string | null> = {
  sangga_api: "상가API 매칭",
  overlap_inferred: "추정 분리",
  license: null,
};

const unitSummaryLine = (u: UnitSummary) => {
  const parts: (string | null)[] =
    u.currentStatus === "영업" ? [u.currentBusinessName, u.industryDetail] : ["지금은 비어 있어요"];
  parts.push(`가게 ${u.totalTenancyCount}곳 거쳐감`, `폐업 ${u.closedCount}번`);
  if (u.averageSurvivalMonths != null) parts.push(`평균 ${u.averageSurvivalMonths}개월`);
  return parts.filter(Boolean).join(" · ");
};

function UnitList({ units }: { units: UnitSummary[] }) {
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">궁금한 점포를 누르면 히스토리가 열려요</p>
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            if (value === "all" || value === "영업" || value === "공실") setStatusFilter(value);
          }}
        >
          <SelectTrigger className="h-8 w-[92px] rounded-full border-border bg-surface text-xs text-navy shadow-none">
            <SelectValue placeholder="필터" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">모두</SelectItem>
            <SelectItem value="영업">영업</SelectItem>
            <SelectItem value="공실">공실</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {sortedUnits.map((u) => {
        const sourceLabel = LOCATION_SOURCE_LABEL[u.locationSource];
        const open = u.currentStatus === "영업";
        return (
          <Link
            key={u.unitId}
            to="/report/$storeId"
            params={{ storeId: u.unitId }}
            className="group block"
          >
            <Card className="relative flex items-center gap-3 overflow-hidden rounded-xl border-border/70 bg-surface p-4 pl-5 shadow-card transition hover:bg-surface-muted/60 hover:shadow-elevated">
              {/* 영업 중인 점포는 왼쪽 초록 강조선 */}
              {open ? <span className="absolute inset-y-0 left-0 w-1 bg-brand" /> : null}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-bold text-navy">{displayUnitLabel(u.label)}</span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <span
                      className={
                        "h-1.5 w-1.5 rounded-full " + (open ? "bg-brand" : "bg-muted-foreground/50")
                      }
                    />
                    {u.currentStatus === "영업" ? "영업" : "공실"}
                  </span>
                  {sourceLabel ? (
                    <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                      {sourceLabel}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1.5 truncate text-sm text-muted-foreground">
                  {unitSummaryLine(u)}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-navy" />
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-11 w-full rounded-2xl" />
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-16 rounded-xl" />
      <Skeleton className="h-16 rounded-xl" />
    </div>
  );
}

function UnitListSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-20 rounded-xl" />
      <Skeleton className="h-20 rounded-xl" />
    </div>
  );
}
