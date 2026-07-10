import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  MapPin,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { buildReport, getStoreById } from "@/lib/mock-data";
import type { RiskLevel } from "@/lib/mock-data";

export const Route = createFileRoute("/report/$storeId")({
  loader: ({ params }) => {
    const store = getStoreById(params.storeId);
    if (!store) throw notFound();
    return { report: buildReport(store) };
  },
  head: ({ loaderData }) => {
    const s = loaderData?.report.store;
    const title = s ? `${s.buildingName} ${s.floor} ${s.unit} · 자리 리포트 | 터봄` : "자리 리포트 | 터봄";
    return {
      meta: [
        { title },
        {
          name: "description",
          content: s
            ? `${s.jibunFull} ${s.floor} ${s.unit}의 운영 이력·폐업 통계·계약 체크리스트 리포트.`
            : "자리별 상가 리포트",
        },
      ],
    };
  },
  component: ReportPage,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <p className="text-sm text-danger">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 className="text-xl font-semibold text-navy">해당 자리를 찾을 수 없습니다</h1>
      <Button asChild className="mt-6 rounded-full bg-navy text-navy-foreground hover:bg-navy/90">
        <Link to="/search">다른 자리 찾기</Link>
      </Button>
    </div>
  ),
});

function ReportPage() {
  const { report } = Route.useLoaderData();
  const { store } = report;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <Breadcrumbs store={store} />
        <ReportHeader report={report} />

        <div className="mt-10 space-y-16">
          <Section index="01" title="핵심 요약" subtitle="가장 먼저 확인할 판단 지표">
            <SummaryGrid report={report} />
          </Section>

          <Section index="02" title="종합 분석" subtitle="운영 이력과 상권 데이터를 함께 해석했습니다">
            <NarrativeCard lines={report.narrative} />
          </Section>

          <Section index="03" title="주변 상권 분석" subtitle="주변 경쟁 환경을 시각적으로 정리했습니다">
            <DistrictAnalysis report={report} />
          </Section>

          <Section index="04" title="위험도" subtitle="여러 신호를 종합한 참고용 등급">
            <RiskCard level={report.summary.riskLevel} label={report.summary.riskLabel} />
          </Section>

          <Section index="05" title="핵심 인사이트" subtitle="판단에 도움이 되는 핵심 내용">
            <InsightGrid insights={report.insights} />
          </Section>

          <Section index="06" title="운영 이력" subtitle="이 자리를 거쳐간 업종의 시간 흐름입니다.">
            <TimelineCard report={report} />
          </Section>

          <Section index="07" title="통계" subtitle="자리 운영과 주변 상권의 숫자">
            <StatsBoard report={report} />
          </Section>

          <Section index="08" title="계약 체크리스트" subtitle="계약 전에 반드시 확인해야 하는 항목">
            <ChecklistCard items={report.checklist} />
          </Section>
        </div>

        <ReportCta />
      </main>
      <SiteFooter />
    </div>
  );
}

function Breadcrumbs({ store }: { store: ReturnType<typeof getStoreById> }) {
  if (!store) return null;
  return (
    <nav className="mb-6 flex items-center gap-1.5 text-xs text-muted-foreground">
      <Link to="/" className="hover:text-navy">
        홈
      </Link>
      <ChevronRight className="h-3 w-3" />
      <Link to="/search" search={{ q: store.jibunBase }} className="hover:text-navy">
        {store.jibunBase}
      </Link>
      <ChevronRight className="h-3 w-3" />
      <span className="text-navy">{store.floor} {store.unit}</span>
    </nav>
  );
}

function ReportHeader({ report }: { report: ReturnType<typeof buildReport> }) {
  const { store, summary, observationYears } = report;
  return (
    <Card className="rounded-2xl border-border/70 bg-surface p-6 shadow-elevated sm:p-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-start">
        <div>
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="outline" className="rounded-full border-border text-muted-foreground">
              <Building2 className="mr-1 h-3 w-3" /> 자리 리포트
            </Badge>
            <span className="text-muted-foreground">관측기간 {observationYears}년</span>
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-navy sm:text-4xl">
            {store.buildingName}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            {store.jibunFull} · {store.roadAddress}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Badge className="rounded-full bg-navy text-navy-foreground hover:bg-navy">
              {store.floor} {store.unit}
            </Badge>
            {store.currentCategory ? (
              <Badge className="rounded-full bg-brand-soft text-navy hover:bg-brand-soft">
                현재 {store.currentCategory}
              </Badge>
            ) : (
              <Badge variant="secondary" className="rounded-full">현재 공실</Badge>
            )}
            {store.currentCategory && (
              <Badge variant="outline" className="rounded-full border-border text-muted-foreground">
                {store.currentMonths}개월 운영
              </Badge>
            )}
          </div>
        </div>
        <RiskBadge level={summary.riskLevel} label={summary.riskLabel} />
      </div>
    </Card>
  );
}

function RiskBadge({ level, label }: { level: RiskLevel; label: string }) {
  const isRisk = level >= 4;
  return (
    <div className="min-w-[220px] rounded-xl border border-border/70 bg-background p-5 text-center">
      <p className="text-xs text-muted-foreground">종합 위험도</p>
      <div className="mt-2 flex justify-center gap-1 text-xl">
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={i <= level ? (isRisk ? "text-danger" : "text-warn") : "text-border"}>
            ★
          </span>
        ))}
      </div>
      <p className={"mt-2 text-lg font-semibold " + (isRisk ? "text-danger" : "text-navy")}>{label}</p>
    </div>
  );
}

function Section({
  index,
  title,
  subtitle,
  children,
}: {
  index: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-5 flex items-baseline gap-3">
        <span className="text-xs font-medium tracking-wider text-brand">SECTION {index}</span>
      </div>
      <h2 className="text-2xl font-bold tracking-tight text-navy sm:text-3xl">{title}</h2>
      {subtitle ? <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p> : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function SummaryGrid({ report }: { report: ReturnType<typeof buildReport> }) {
  const s = report.summary;
  const items = [
    { label: "위험도", value: <StarValue level={s.riskLevel} />, note: s.riskLabel },
    { label: "최근 폐업", value: `${s.closureCount}회` },
    { label: "평균 생존기간", value: `${s.avgSurvivalMonths}개월` },
    { label: "현재 업종", value: s.currentCategory },
    { label: "현재 운영기간", value: `${s.currentMonths}개월` },
    { label: "동일 업종", value: `${s.sameCategoryCount}개` },
    { label: "반경 내 점포", value: `${s.nearbyStoreCount}개` },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((it) => (
        <Card key={it.label} className="rounded-xl border-border/70 bg-surface p-5 shadow-card">
          <p className="text-xs text-muted-foreground">{it.label}</p>
          <div className="mt-2 text-2xl font-bold text-navy">{it.value}</div>
          {it.note ? <p className="mt-1 text-xs text-muted-foreground">{it.note}</p> : null}
        </Card>
      ))}
    </div>
  );
}

function StarValue({ level }: { level: RiskLevel }) {
  return (
    <div className="flex gap-0.5 text-xl">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= level ? "text-danger" : "text-border"}>★</span>
      ))}
    </div>
  );
}

function NarrativeCard({ lines }: { lines: string[] }) {
  return (
    <Card className="rounded-2xl border-border/70 bg-surface p-6 shadow-card sm:p-8">
      <ul className="space-y-3">
        {lines.map((line, i) => (
          <li key={i} className="flex gap-3 text-sm leading-relaxed text-foreground sm:text-base">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function DistrictAnalysis({ report }: { report: ReturnType<typeof buildReport> }) {
  const { composition, competitionScore, stats, tags } = report.district;
  const max = Math.max(...composition.map((c) => c.count));
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <Card className="rounded-2xl border-border/70 bg-surface p-6 shadow-card">
        <div className="flex items-baseline justify-between">
          <h3 className="text-base font-semibold text-navy">업종 구성</h3>
          <span className="text-xs text-muted-foreground">반경 300m · 업종별 점포 수</span>
        </div>
        <div className="mt-5 space-y-3">
          {composition.map((c) => (
            <div key={c.category}>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{c.category}</span>
                <span className="font-medium text-navy">{c.count}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-navy"
                  style={{ width: `${(c.count / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
      <div className="space-y-4">
        <Card className="rounded-2xl border-border/70 bg-surface p-6 shadow-card">
          <div className="flex items-baseline justify-between">
            <h3 className="text-base font-semibold text-navy">경쟁도</h3>
            <span className="text-xs text-muted-foreground">Competition Score</span>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-4xl font-bold text-navy">{competitionScore}</span>
            <span className="text-sm text-muted-foreground">/ 100</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-warn" style={{ width: `${competitionScore}%` }} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">경쟁이 다소 치열한 상권입니다.</p>
        </Card>
        <Card className="rounded-2xl border-border/70 bg-surface p-6 shadow-card">
          <h3 className="text-base font-semibold text-navy">상권 통계</h3>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <StatRow k="동일 업종" v={String(stats.sameCategory)} />
            <StatRow k="최근 개업" v={String(stats.recentOpenings)} />
            <StatRow k="전체 점포" v={String(stats.totalStores)} />
            <StatRow k="집계 기준일" v={stats.referenceDate} />
          </dl>
        </Card>
        <Card className="rounded-2xl border-border/70 bg-surface p-6 shadow-card">
          <h3 className="text-base font-semibold text-navy">상권 특징</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {tags.map((t) => (
              <Badge key={t} variant="secondary" className="rounded-full bg-brand-soft text-navy">
                <MapPin className="mr-1 h-3 w-3 text-brand" />
                {t}
              </Badge>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatRow({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className="mt-0.5 text-base font-semibold text-navy">{v}</dd>
    </div>
  );
}

function RiskCard({ level, label }: { level: RiskLevel; label: string }) {
  const pct = (level / 5) * 100;
  const isRisk = level >= 4;
  return (
    <Card className="rounded-2xl border-border/70 bg-surface p-8 shadow-card">
      <div className="grid gap-8 lg:grid-cols-[auto_1fr] lg:items-center">
        <div className="text-center">
          <StarValue level={level} />
          <p className={"mt-3 text-2xl font-bold " + (isRisk ? "text-danger" : "text-navy")}>{label}</p>
          <p className="mt-1 text-xs text-muted-foreground">Level {level} / 5</p>
        </div>
        <div>
          <div className="h-3 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${pct}%`,
                background: isRisk
                  ? "linear-gradient(90deg, var(--warn), var(--danger))"
                  : "linear-gradient(90deg, var(--brand), var(--warn))",
              }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
            <span>매우 안정</span>
            <span>안정</span>
            <span>보통</span>
            <span>위험</span>
            <span>매우 위험</span>
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

const INSIGHT_ICONS = {
  trending: TrendingUp,
  users: Users,
  sparkles: Sparkles,
  clock: Clock,
} as const;

function InsightGrid({ insights }: { insights: ReturnType<typeof buildReport>["insights"] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {insights.map((it) => {
        const Icon = INSIGHT_ICONS[it.icon as keyof typeof INSIGHT_ICONS] ?? Sparkles;
        return (
          <Card key={it.title} className="rounded-2xl border-border/70 bg-surface p-6 shadow-card">
            <div className="flex items-start gap-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                <Icon className="h-5 w-5" />
              </span>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-navy">{it.title}</h3>
                <p className="mt-1 text-2xl font-bold text-navy">{it.metric}</p>
                <p className="mt-2 text-sm text-muted-foreground">{it.description}</p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function TimelineCard({ report }: { report: ReturnType<typeof buildReport> }) {
  const items = report.store.history;
  return (
    <Card className="rounded-2xl border-border/70 bg-surface p-6 shadow-card sm:p-8">
      <div className="relative">
        <div className="absolute left-0 right-0 top-6 h-px bg-border" />
        <div className="relative flex gap-6 overflow-x-auto pb-2">
          {items.map((h, i) => {
            const active = !!h.current;
            return (
              <div key={i} className="min-w-[180px] flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={
                      "grid h-3 w-3 place-items-center rounded-full ring-4 " +
                      (active ? "bg-brand ring-brand-soft" : "bg-muted-foreground/50 ring-secondary")
                    }
                  />
                  <span className="text-[11px] text-muted-foreground">{h.period}</span>
                </div>
                <div className="mt-4">
                  <div className="flex items-center gap-2">
                    <p className="text-base font-semibold text-navy">{h.category}</p>
                    {active && (
                      <Badge className="rounded-full bg-brand text-brand-foreground hover:bg-brand text-[10px]">
                        운영 중
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{h.brand}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{h.months}개월</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function StatsBoard({ report }: { report: ReturnType<typeof buildReport> }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <StatColumn title="자리 운영" items={report.stats.self} />
      <StatColumn title="주변 상권" items={report.stats.area} />
    </div>
  );
}

function StatColumn({
  title,
  items,
}: {
  title: string;
  items: { label: string; value: string; hint?: string; wide?: boolean }[];
}) {
  return (
    <div>
      <h3 className="mb-4 text-sm font-medium text-muted-foreground">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((it) => (
          <Card
            key={it.label}
            className={
              "rounded-xl border-border/70 bg-surface p-5 shadow-card " +
              (it.wide ? "sm:col-span-2" : "")
            }
          >
            <p className="text-xs text-muted-foreground">{it.label}</p>
            <p className="mt-2 text-2xl font-bold text-navy">{it.value}</p>
            {it.hint ? <p className="mt-1 text-xs text-muted-foreground">{it.hint}</p> : null}
          </Card>
        ))}
      </div>
    </div>
  );
}

function ChecklistCard({ items }: { items: { key: string; label: string }[] }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const done = items.filter((i) => checked[i.key]).length;
  const pct = Math.round((done / items.length) * 100);
  return (
    <Card className="rounded-2xl border-border/70 bg-surface p-6 shadow-card sm:p-8">
      <div className="flex items-baseline justify-between">
        <h3 className="text-base font-semibold text-navy">계약 전 확인 항목</h3>
        <span className="text-sm text-muted-foreground">
          {done} / {items.length}
        </span>
      </div>
      <Progress value={pct} className="mt-3 h-2 bg-secondary [&>div]:bg-brand" />
      <Separator className="my-5" />
      <ul className="space-y-3">
        {items.map((it) => {
          const on = !!checked[it.key];
          return (
            <li key={it.key}>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg p-2 -m-2 transition hover:bg-secondary/60">
                <Checkbox
                  checked={on}
                  onCheckedChange={(v) => setChecked((s) => ({ ...s, [it.key]: !!v }))}
                  className="data-[state=checked]:bg-brand data-[state=checked]:border-brand"
                />
                <span
                  className={
                    "text-sm " + (on ? "text-muted-foreground line-through" : "text-foreground")
                  }
                >
                  {it.label}
                </span>
                {on ? (
                  <CheckCircle2 className="ml-auto h-4 w-4 text-brand" />
                ) : (
                  <Circle className="ml-auto h-4 w-4 text-border" />
                )}
              </label>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function ReportCta() {
  return (
    <div className="mt-20 overflow-hidden rounded-3xl bg-navy p-10 text-navy-foreground sm:p-14">
      <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-bold sm:text-3xl">좋은 창업은 여러 자리를 비교하는 것에서 시작됩니다.</h2>
          <p className="mt-2 text-sm text-navy-foreground/70">다른 자리와 비교해 보세요.</p>
        </div>
        <Button asChild size="lg" className="rounded-full bg-background text-navy hover:bg-background/90">
          <Link to="/search">
            새로운 자리 분석하기
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
