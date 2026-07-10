import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { AlertTriangle, ChevronRight, MapPin, Search as SearchIcon, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SiteHeader } from "@/components/site-header";
import { DEMO_ADDRESSES } from "@/lib/mock-data";
import { isDemoMode } from "@/lib/api";
import type { Candidate, LocationSource, UnitSummary } from "@/lib/api";
import { useSiteDetail, useSiteSearch } from "@/hooks/use-sites";
import { MapView } from "@/components/map-view";

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";

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

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
          className="flex flex-col gap-2 sm:flex-row"
        >
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="예: 성남시 수정구 신흥동 123"
              className="h-12 rounded-full border-border bg-surface pl-11 pr-4 text-base focus-visible:ring-brand"
            />
          </div>
          <Button
            type="submit"
            size="lg"
            className="h-12 rounded-full bg-navy px-8 text-navy-foreground hover:bg-navy/90"
          >
            검색
          </Button>
        </form>

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
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
            <div className="space-y-6">
              <JibunTabs
                candidates={candidates}
                activeJibun={activeCandidate?.jibunAddress ?? ""}
                onSelect={(j) => navigate({ to: "/search", search: { q, jibun: j } })}
              />
              {activeCandidate && <ActiveJibunSummary candidate={activeCandidate} />}

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

              {siteDetailQuery.data?.disclaimer && (
                <p className="text-xs text-muted-foreground">
                  기준일 {siteDetailQuery.data.disclaimer.dataAsOf} ·{" "}
                  {siteDetailQuery.data.disclaimer.note}
                </p>
              )}
            </div>
            <div className="lg:sticky lg:top-24 lg:self-start">
              {activeCandidate &&
              (activeCandidate.latitude == null || activeCandidate.longitude == null) ? (
                <Card className="flex h-[420px] flex-col items-center justify-center gap-2 rounded-2xl border-border/70 p-6 text-center shadow-card lg:h-[640px]">
                  <MapPin className="h-6 w-6 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">이 자리는 위치 정보가 없습니다.</p>
                </Card>
              ) : (
                <Card className="overflow-hidden rounded-2xl border-border/70 p-0 shadow-card">
                  <MapView
                    markers={candidates
                      .filter((c) => c.latitude != null && c.longitude != null)
                      .map((c) => ({
                        id: c.pnu,
                        lat: c.latitude as number,
                        lng: c.longitude as number,
                        label: c.jibunAddress,
                        active: c.jibunAddress === activeCandidate?.jibunAddress,
                      }))}
                  />
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onDemo }: { onDemo: (addr: string) => void }) {
  return (
    <Card className="mt-10 rounded-2xl border-dashed border-border bg-surface-muted/40 p-10 text-center shadow-none">
      <MapPin className="mx-auto h-8 w-8 text-brand" />
      <h2 className="mt-4 text-xl font-semibold text-navy">지번 주소로 검색을 시작하세요</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        본번까지 입력하시면 해당 지번의 모든 상가와 층·호수를 보여드립니다.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
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
    </Card>
  );
}

function NoResults({ query }: { query: string }) {
  return (
    <Card className="mt-10 rounded-2xl border-border bg-surface p-10 text-center shadow-card">
      <h2 className="text-xl font-semibold text-navy">"{query}" 결과가 없습니다</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {isDemoMode
          ? "데모 모드에서는 아래 세 개 지번만 지원합니다."
          : "다른 지번 주소로 다시 검색해보세요."}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
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
    </Card>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="mt-10 rounded-2xl border-danger/30 bg-surface p-10 text-center shadow-card">
      <AlertTriangle className="mx-auto h-8 w-8 text-danger" />
      <h2 className="mt-4 text-lg font-semibold text-navy">불러오는 중 문제가 발생했습니다</h2>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" className="mt-6 rounded-full" onClick={onRetry}>
        다시 시도
      </Button>
    </Card>
  );
}

function JibunTabs({
  candidates,
  activeJibun,
  onSelect,
}: {
  candidates: Candidate[];
  activeJibun: string;
  onSelect: (jibun: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {candidates.map((c) => {
        const active = c.jibunAddress === activeJibun;
        return (
          <button
            key={c.pnu}
            onClick={() => onSelect(c.jibunAddress)}
            className={
              "rounded-full px-4 py-2 text-sm transition " +
              (active
                ? "bg-navy text-navy-foreground"
                : "border border-border bg-surface text-navy hover:border-brand/40")
            }
          >
            {c.jibunAddress.split(" ").slice(-1)[0]}
          </button>
        );
      })}
    </div>
  );
}

function ActiveJibunSummary({ candidate }: { candidate: Candidate }) {
  return (
    <Card className="rounded-2xl border-border/70 bg-surface p-5 shadow-card">
      <p className="text-xs font-medium text-brand">지금 보고 있는 자리</p>
      <h2 className="mt-2 text-xl font-semibold text-navy">{candidate.jibunAddress}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{candidate.roadAddress}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant="secondary" className="rounded-full bg-secondary text-navy">
          점포 {candidate.unitCount}개
        </Badge>
        <Badge className="rounded-full bg-warn-soft text-warn hover:bg-warn-soft">
          폐업 이력 {candidate.closedCount}건
        </Badge>
      </div>
    </Card>
  );
}

const LOCATION_SOURCE_LABEL: Record<LocationSource, string> = {
  license: "인허가 매칭",
  sangga_api: "상가API 매칭",
  overlap_inferred: "추정 분리",
};

const unitSummaryLine = (u: UnitSummary) => {
  const head = u.currentBusinessName
    ? u.industryDetail
      ? `${u.currentBusinessName} · ${u.industryDetail}`
      : u.currentBusinessName
    : "지금은 비어 있어요";
  const tail = [`가게 ${u.totalTenancyCount}곳 거쳐감`, `폐업 ${u.closedCount}번`];
  if (u.averageSurvivalMonths != null) tail.push(`평균 ${u.averageSurvivalMonths}개월`);
  return `${head} · ${tail.join(" · ")}`;
};

function UnitList({ units }: { units: UnitSummary[] }) {
  if (!units.length) return null;
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">궁금한 점포를 누르면 히스토리가 열려요</p>
      {units.map((u) => (
        <Link
          key={u.unitId}
          to="/report/$storeId"
          params={{ storeId: u.unitId }}
          className="group block"
        >
          <Card
            className={
              "flex items-center gap-3 rounded-xl border-l-4 border-border/70 bg-surface p-4 shadow-card transition hover:border-l-brand hover:shadow-elevated " +
              (u.currentStatus === "영업" ? "border-l-brand" : "border-l-border")
            }
          >
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-semibold text-navy">{u.label}</span>
                <span className="flex items-center gap-1 text-xs">
                  <span
                    className={
                      "h-1.5 w-1.5 rounded-full " +
                      (u.currentStatus === "영업" ? "bg-brand" : "bg-muted-foreground/50")
                    }
                  />
                  <span className="text-muted-foreground">{u.currentStatus}</span>
                </span>
                <Badge
                  variant="secondary"
                  className="rounded-full bg-secondary text-[10px] text-navy"
                >
                  {LOCATION_SOURCE_LABEL[u.locationSource]}
                </Badge>
              </div>
              <p className="mt-1.5 line-clamp-1 text-sm text-muted-foreground">
                {unitSummaryLine(u)}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-navy" />
          </Card>
        </Link>
      ))}
    </div>
  );
}

function SearchSkeleton() {
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
      <div className="space-y-4">
        <Skeleton className="h-9 w-40 rounded-full" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
      <Skeleton className="h-[500px] rounded-2xl" />
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
