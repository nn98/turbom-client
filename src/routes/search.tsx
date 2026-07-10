import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { ChevronRight, MapPin, Search as SearchIcon, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SiteHeader } from "@/components/site-header";
import { searchByJibun, DEMO_ADDRESSES } from "@/lib/mock-data";
import type { AddressSearchResult, Store } from "@/lib/mock-data";
import { MapView } from "@/components/map-view";

const searchSchema = z.object({
  q: z.string().optional().catch(""),
  jibun: z.string().optional().catch(""),
  demo: z.boolean().optional().catch(false),
});

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "자리 분석 · 터봄" },
      { name: "description", content: "지번 주소로 동일 지번 내 모든 상가와 층·호를 확인하고 리포트를 확인하세요." },
    ],
  }),
  validateSearch: searchSchema,
  component: SearchPage,
});

function SearchPage() {
  const { q = "", jibun = "" } = Route.useSearch();
  const navigate = useNavigate();
  const [input, setInput] = useState(q);
  const [loading, setLoading] = useState(false);

  useEffect(() => setInput(q), [q]);

  const result: AddressSearchResult | null = useMemo(() => {
    if (!q) return null;
    return searchByJibun(q);
  }, [q]);

  const activeJibun = jibun || result?.groups[0]?.jibunFull || "";
  const activeGroup = result?.groups.find((g) => g.jibunFull === activeJibun) ?? result?.groups[0];
  const stores: Store[] = result && activeGroup ? result.storesByJibun[activeGroup.jibunFull] ?? [] : [];

  const submit = (query: string) => {
    if (!query.trim()) return;
    setLoading(true);
    setTimeout(() => setLoading(false), 300);
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
          <Button type="submit" size="lg" className="h-12 rounded-full bg-navy px-8 text-navy-foreground hover:bg-navy/90">
            검색
          </Button>
        </form>

        {!q ? (
          <EmptyState onDemo={(addr) => submit(addr)} />
        ) : loading ? (
          <SearchSkeleton />
        ) : !result ? (
          <NoResults query={q} />
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
            <div className="space-y-6">
              <JibunTabs
                result={result}
                activeJibun={activeGroup?.jibunFull ?? ""}
                onSelect={(j) => navigate({ to: "/search", search: { q, jibun: j } })}
              />
              {activeGroup && <ActiveJibunSummary group={activeGroup} />}
              <StoreList stores={stores} />
              <p className="text-xs text-muted-foreground">
                기준일 2026-07-04 · 인허가 신고 기준 데이터로 실제 영업 현황과 차이가 있을 수 있습니다.
              </p>
            </div>
            <div className="lg:sticky lg:top-24 lg:self-start">
              <Card className="overflow-hidden rounded-2xl border-border/70 p-0 shadow-card">
                <MapView
                  markers={
                    result?.groups.map((g) => ({
                      id: g.jibunFull,
                      lat: g.lat,
                      lng: g.lng,
                      label: g.jibunFull,
                      active: g.jibunFull === activeGroup?.jibunFull,
                    })) ?? []
                  }
                />
              </Card>
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
      <p className="mt-2 text-sm text-muted-foreground">데모 모드에서는 아래 세 개 지번만 지원합니다.</p>
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

function JibunTabs({
  result,
  activeJibun,
  onSelect,
}: {
  result: AddressSearchResult;
  activeJibun: string;
  onSelect: (jibun: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {result.groups.map((g) => {
        const active = g.jibunFull === activeJibun;
        return (
          <button
            key={g.jibunFull}
            onClick={() => onSelect(g.jibunFull)}
            className={
              "rounded-full px-4 py-2 text-sm transition " +
              (active
                ? "bg-navy text-navy-foreground"
                : "border border-border bg-surface text-navy hover:border-brand/40")
            }
          >
            {g.jibunFull.split(" ").slice(-1)[0]}
          </button>
        );
      })}
    </div>
  );
}

function ActiveJibunSummary({
  group,
}: {
  group: { jibunFull: string; roadAddress: string; storeCount: number; closureCount: number };
}) {
  return (
    <Card className="rounded-2xl border-border/70 bg-surface p-5 shadow-card">
      <p className="text-xs font-medium text-brand">지금 보고 있는 자리</p>
      <h2 className="mt-2 text-xl font-semibold text-navy">{group.jibunFull}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{group.roadAddress}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant="secondary" className="rounded-full bg-secondary text-navy">
          점포 {group.storeCount}개
        </Badge>
        <Badge className="rounded-full bg-warn-soft text-warn hover:bg-warn-soft">
          폐업 이력 {group.closureCount}건
        </Badge>
      </div>
    </Card>
  );
}

function StoreList({ stores }: { stores: Store[] }) {
  if (!stores.length) return null;
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">궁금한 점포를 누르면 히스토리가 열려요</p>
      {stores.map((s) => (
        <Link
          key={s.id}
          to="/report/$storeId"
          params={{ storeId: s.id }}
          className="group block"
        >
          <Card
            className={
              "flex items-center gap-3 rounded-xl border-l-4 border-border/70 bg-surface p-4 shadow-card transition hover:border-l-brand hover:shadow-elevated " +
              (s.status === "영업" ? "border-l-brand" : "border-l-border")
            }
          >
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-semibold text-navy">
                  {s.floor} {s.unit}
                </span>
                <span className="flex items-center gap-1 text-xs">
                  <span
                    className={
                      "h-1.5 w-1.5 rounded-full " + (s.status === "영업" ? "bg-brand" : "bg-muted-foreground/50")
                    }
                  />
                  <span className="text-muted-foreground">{s.status}</span>
                </span>
                <Badge variant="secondary" className="rounded-full bg-secondary text-[10px] text-navy">
                  {s.matched}
                </Badge>
              </div>
              <p className="mt-1.5 line-clamp-1 text-sm text-muted-foreground">{s.summary}</p>
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
