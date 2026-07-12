import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { RiskBadge, riskToneOf } from "@/components/risk-badge";
import { ApiRequestError, buildUnitAnalysis, findOccupant, isOccupiedStatus } from "@/lib/api";
import type { RiskLevel, Tenancy, UnitAnalysis, UnitDetail } from "@/lib/api";
import { useUnitDetail } from "@/hooks/use-sites";

const jibunBaseOf = (jibunAddress: string) => jibunAddress.replace(/-\d+$/, "");
const formatKrw = (n: number) => `${n.toLocaleString("ko-KR")}원`;
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
const displayUnitLabel = (label: string) => {
  if (label.match(/-?\d+\s*층/)) return label;
  const explicitFloor = floorSortValue(label);
  if (explicitFloor !== Number.MAX_SAFE_INTEGER) return label;
  const unit = unitSortValue(label);
  if (unit === Number.MAX_SAFE_INTEGER) return label;
  const inferredFloor = unit >= 100 ? Math.floor(unit / 100) : 0;
  return `${inferredFloor}층 ${label}`;
};

export const Route = createFileRoute("/report/$storeId")({
  head: () => ({
    meta: [
      { title: "자리 리포트 | 터봄" },
      {
        name: "description",
        content: "층·호 단위 상가의 운영 이력·폐업 통계·계약 체크리스트 리포트.",
      },
    ],
  }),
  component: ReportPage,
});

function ReportPage() {
  const { storeId } = Route.useParams();
  const unitQuery = useUnitDetail(storeId);

  if (unitQuery.isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <ReportSkeleton />
        </main>
      </div>
    );
  }

  if (unitQuery.isError) {
    const notFound =
      unitQuery.error instanceof ApiRequestError && unitQuery.error.code === "UNIT_NOT_FOUND";
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="mx-auto max-w-lg px-4 py-24 text-center">
          {notFound ? (
            <>
              <h1 className="text-xl font-semibold text-navy">해당 자리를 찾을 수 없습니다</h1>
              <Button
                asChild
                className="mt-6 rounded-full bg-navy text-navy-foreground hover:bg-navy/90"
              >
                <Link to="/search">다른 자리 찾기</Link>
              </Button>
            </>
          ) : (
            <>
              <AlertTriangle className="mx-auto h-8 w-8 text-danger" />
              <p className="mt-4 text-sm text-danger">{errorMessage(unitQuery.error)}</p>
              <Button
                variant="outline"
                className="mt-6 rounded-full"
                onClick={() => unitQuery.refetch()}
              >
                다시 시도
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  const detail = unitQuery.data;
  if (!detail) return null;
  const analysis = buildUnitAnalysis(detail);
  const current = findOccupant(detail.timeline);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <Breadcrumbs detail={detail} />
        <ReportHeader detail={detail} current={current} riskLevel={analysis.riskLevel} />

        <div className="mt-10 space-y-16">
          <Section title="통계" subtitle="이 자리에서 먼저 확인할 핵심 지표">
            <SummaryGrid detail={detail} analysis={analysis} current={current} />
            <div className="mt-6">
              <StatsBoard detail={detail} current={current} />
            </div>
          </Section>

          <Section title="종합 분석" subtitle="운영 이력과 상권 데이터를 함께 해석했습니다">
            <NarrativeCard lines={analysis.narrative} />
          </Section>

          <Section title="주변 상권 분석" subtitle="주변 경쟁 환경을 시각적으로 정리했습니다">
            <DistrictAnalysis district={analysis.district} />
          </Section>

          <Section title="위험도" subtitle="여러 신호를 종합한 참고용 등급">
            <RiskCard level={analysis.riskLevel} label={analysis.riskLabel} />
          </Section>

          <Section title="운영 이력" subtitle="이 자리를 거쳐간 업종의 시간 흐름입니다.">
            <TimelineCard timeline={detail.timeline} />
          </Section>

          <Section title="계약 체크리스트" subtitle="계약 전에 반드시 확인해야 하는 항목">
            <ChecklistCard items={analysis.checklist} />
          </Section>
        </div>

        <ReportCta />
      </main>
      <SiteFooter />
    </div>
  );
}

function Breadcrumbs({ detail }: { detail: UnitDetail }) {
  const { unit } = detail;
  return (
    <nav className="mb-6 flex items-center gap-1.5 text-xs text-muted-foreground">
      <Link to="/" className="hover:text-navy">
        홈
      </Link>
      <ChevronRight className="h-3 w-3" />
      <Link to="/search" search={{ q: jibunBaseOf(unit.jibunAddress) }} className="hover:text-navy">
        {jibunBaseOf(unit.jibunAddress)}
      </Link>
      <ChevronRight className="h-3 w-3" />
      <span className="text-navy">{unit.label}</span>
    </nav>
  );
}

// 카드 좌측의 얇은 강조선 하나로만 위험도를 알린다 — 별점/그라데이션 같은
// 장식 대신, 이미 익숙한 "상태 표시줄" 패턴 하나로 절제.
function ReportHeader({
  detail,
  current,
  riskLevel,
}: {
  detail: UnitDetail;
  current: Tenancy | null;
  riskLevel: RiskLevel;
}) {
  const { unit, disclaimer } = detail;
  const accentClass =
    riskLevel >= 4 ? "before:bg-danger" : riskLevel === 3 ? "before:bg-warn" : "before:bg-brand";
  return (
    <Card
      className={
        "relative overflow-hidden rounded-2xl border-border/70 bg-surface p-6 shadow-elevated before:absolute before:inset-y-0 before:left-0 before:w-1 sm:p-8 " +
        accentClass
      }
    >
      <div>
        <div className="flex items-center gap-2 text-xs">
          <Badge variant="outline" className="rounded-full border-border text-muted-foreground">
            <Building2 className="mr-1 h-3 w-3" /> 자리 리포트
          </Badge>
          <span className="text-muted-foreground">기준일 {disclaimer.dataAsOf}</span>
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-navy sm:text-4xl">
          {current
            ? `${displayUnitLabel(unit.label)}) ${current.businessName}`
            : displayUnitLabel(unit.label)}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">{unit.jibunAddress}</p>
      </div>
    </Card>
  );
}

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

function SummaryGrid({
  detail,
  analysis,
  current,
}: {
  detail: UnitDetail;
  analysis: UnitAnalysis;
  current: Tenancy | null;
}) {
  const { statistics } = detail;
  const items = [
    { label: "위험도", value: <RiskBadge level={analysis.riskLevel} label={analysis.riskLabel} /> },
    {
      label: "평균 생존기간",
      value:
        statistics.averageSurvivalMonths != null ? `${statistics.averageSurvivalMonths}개월` : "-",
    },
    {
      label: "현재 업종",
      value: current ? (current.industryDetail ?? current.subCategory) : "공실",
      note: current?.status === "휴업" ? "휴업 중" : undefined,
    },
    { label: "현재 운영기간", value: current ? `${current.survivalMonths}개월` : "-" },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((it) => (
        <Card key={it.label} className="rounded-xl border-border/70 bg-surface p-5 shadow-card">
          <p className="text-xs text-muted-foreground">{it.label}</p>
          <div className="mt-2 text-2xl font-bold tabular-nums text-navy">{it.value}</div>
          {it.note ? <p className="mt-1 text-xs text-muted-foreground">{it.note}</p> : null}
        </Card>
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

function DistrictAnalysis({ district }: { district: UnitAnalysis["district"] }) {
  const { composition, stats } = district;
  const [selectedCategory, setSelectedCategory] = useState(() => composition[0] ?? null);
  const max = Math.max(...composition.map((c) => c.count));
  const competitionScore = selectedCategory ? Math.round(selectedCategory.ratio * 100) : 0;
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <Card className="rounded-2xl border-border/70 bg-surface p-6 shadow-card">
        <div className="flex items-baseline justify-between">
          <h3 className="text-base font-semibold text-navy">업종 구성</h3>
          <span className="text-xs text-muted-foreground">반경 300m · 업종별 점포 수</span>
        </div>
        <div className="mt-5 space-y-3">
          {composition.map((c) => (
            <button
              key={c.category}
              type="button"
              onClick={() => setSelectedCategory(c)}
              className={
                "block w-full rounded-xl p-2 text-left transition " +
                (selectedCategory?.category === c.category
                  ? "bg-secondary/60"
                  : "hover:bg-secondary/30")
              }
            >
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{c.category}</span>
                <span className="font-medium tabular-nums text-navy">{c.count}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(c.count / max) * 100}%`,
                    background: "var(--color-navy)",
                  }}
                />
              </div>
            </button>
          ))}
        </div>
      </Card>
      <div className="space-y-4">
        <Card className="rounded-2xl border-border/70 bg-surface p-6 shadow-card">
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
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-4xl font-bold tabular-nums text-navy">{competitionScore}</span>
            <span className="text-sm text-muted-foreground">/ 100</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-warn"
              style={{ width: `${competitionScore}%` }}
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {competitionCaptionOf(competitionScore)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground/70">
            선택한 업종의 반경 300m 내 점포 비중 기준 참고 지표입니다.
          </p>
        </Card>
        <Card className="rounded-2xl border-border/70 bg-surface p-6 shadow-card">
          <h3 className="text-base font-semibold text-navy">상권 통계</h3>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <StatRow k="동일 업종" v={String(stats.sameCategory ?? 0)} />
            <StatRow k="전체 점포" v={String(stats.totalStores)} />
            <StatRow k="집계 기준일" v={stats.referenceDate} />
          </dl>
        </Card>
      </div>
    </div>
  );
}

// competitionScore(동일 업종/전체 점포 비중)를 사람이 읽는 문구로 매핑.
// 구간 자체는 임의 설정이지만 입력값(competitionScore)은 실데이터 기반 계산값이다.
function competitionCaptionOf(score: number): string {
  if (score >= 20) return "경쟁이 치열한 상권입니다.";
  if (score >= 10) return "경쟁이 보통 수준인 상권입니다.";
  return "경쟁이 상대적으로 적은 상권입니다.";
}

function StatRow({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className="mt-0.5 text-base font-semibold tabular-nums text-navy">{v}</dd>
    </div>
  );
}

const RISK_BAR_CLASS: Record<"danger" | "warn" | "brand", string> = {
  danger: "bg-danger",
  warn: "bg-warn",
  brand: "bg-brand",
};

function RiskCard({ level, label }: { level: RiskLevel; label: string }) {
  const pct = (level / 5) * 100;
  return (
    <Card className="rounded-2xl border-border/70 bg-surface p-8 shadow-card">
      <div className="grid gap-8 lg:grid-cols-[auto_1fr] lg:items-center">
        <div className="text-center">
          <RiskBadge level={level} label={label} />
          <p className="mt-3 text-xs tabular-nums text-muted-foreground">Level {level} / 5</p>
        </div>
        <div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className={"h-full rounded-full transition-all " + RISK_BAR_CLASS[riskToneOf(level)]}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
            <span>안정</span>
            <span>위험</span>
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

// docs/spec/api-spec.md "③ 물건 상세" 화면 규격: 타임라인(가로 바) + tenancyId
// 선택 드롭다운 → 좌: 인허가정보 / 우: marketInfo(sameCategoryNearbyCount만
// 실값, 나머지는 "예시" 뱃지 + 캡션 상시 노출).
function TimelineCard({ timeline }: { timeline: Tenancy[] }) {
  const [selectedId, setSelectedId] = useState(
    () => findOccupant(timeline)?.tenancyId ?? timeline[timeline.length - 1]?.tenancyId ?? "",
  );
  const selected =
    timeline.find((t) => t.tenancyId === selectedId) ?? timeline[timeline.length - 1];

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-border/70 bg-surface p-2 shadow-card sm:p-3">
        <ul className="divide-y divide-border">
          {timeline.map((t) => {
            const displayCategory = t.industryDetail ?? t.subCategory;
            return (
              <li key={t.tenancyId}>
                <button
                  type="button"
                  onClick={() => setSelectedId(t.tenancyId)}
                  className={
                    "flex w-full items-start gap-3 rounded-lg px-4 py-3 text-left transition hover:bg-secondary/40 " +
                    (t.tenancyId === selectedId ? "bg-secondary/50" : "")
                  }
                >
                  <span className="mt-1.5 shrink-0">
                    <StatusDot status={t.status} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm font-semibold text-navy">
                        {t.businessName}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {t.survivalMonths}개월
                      </span>
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      <span>{t.status}</span>
                      <span className="tabular-nums">
                        {t.licensedAt.slice(0, 7)} — {t.closedAt ? t.closedAt.slice(0, 7) : "현재"}
                      </span>
                      <span>{displayCategory}</span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      {selected && (
        <Card className="rounded-2xl border-border/70 bg-surface p-6 shadow-card sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-navy">가게 자세히 보기</h3>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="w-full rounded-full sm:w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timeline.map((t) => (
                  <SelectItem key={t.tenancyId} value={t.tenancyId}>
                    {t.businessName} ({t.licensedAt.slice(0, 7)}
                    {t.closedAt ? ` — ${t.closedAt.slice(0, 7)}` : " — 현재"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground">인허가 정보</p>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <StatRow k="상호" v={selected.businessName} />
                <StatRow k="상태" v={selected.status} />
                <StatRow k="업종(대분류)" v={selected.category} />
                <StatRow k="업종(소분류)" v={selected.subCategory} />
                <StatRow
                  k="운영 기간"
                  v={`${selected.licensedAt.slice(0, 7)} — ${selected.closedAt ? selected.closedAt.slice(0, 7) : "현재"}`}
                />
                {selected.industryDetail && (
                  <StatRow k="상가API 세부업종" v={selected.industryDetail} />
                )}
              </dl>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">시세 정보</p>
                {selected.marketInfo.isPlaceholder && (
                  <Badge
                    variant="outline"
                    className="rounded-full border-border text-[10px] text-muted-foreground"
                  >
                    예시
                  </Badge>
                )}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <MarketRow
                  k="동일업종 인근"
                  v={`${selected.marketInfo.sameCategoryNearbyCount ?? 0}개`}
                  real
                />
                <MarketRow
                  k="전용면적"
                  v={
                    selected.marketInfo.leaseAreaSqm != null
                      ? `${selected.marketInfo.leaseAreaSqm}㎡`
                      : "-"
                  }
                />
                <MarketRow
                  k="보증금"
                  v={
                    selected.marketInfo.depositKrw != null
                      ? formatKrw(selected.marketInfo.depositKrw)
                      : "-"
                  }
                />
                <MarketRow
                  k="월세"
                  v={
                    selected.marketInfo.monthlyRentKrw != null
                      ? formatKrw(selected.marketInfo.monthlyRentKrw)
                      : "-"
                  }
                />
                <MarketRow
                  k="권리금"
                  v={
                    selected.marketInfo.keyMoneyKrw != null
                      ? formatKrw(selected.marketInfo.keyMoneyKrw)
                      : "-"
                  }
                />
                <MarketRow
                  k="일일 유동인구"
                  v={
                    selected.marketInfo.dailyFloatingPopulation != null
                      ? `${selected.marketInfo.dailyFloatingPopulation.toLocaleString("ko-KR")}명`
                      : "-"
                  }
                />
                <MarketRow
                  k="공실률"
                  v={
                    selected.marketInfo.vacancyRatePercent != null
                      ? `${selected.marketInfo.vacancyRatePercent}%`
                      : "-"
                  }
                />
              </dl>
              {selected.marketInfo.isPlaceholder && (
                <p className="mt-3 text-xs text-muted-foreground">
                  실 데이터 연동 전 예시값입니다.
                </p>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

// 폐업/취소/말소 등 영업·휴업이 아닌 모든 상태는 빈 원(○)으로 통일 —
// isOccupiedStatus()와 같은 기준(CLAUDE.md "알려진 스펙-실측 차이" 참고).
// inline-block이 필수 — 이 span은 flex 컨테이너의 직접 자식이 아니라(래퍼
// span 안에 있어) blockify가 안 되고 display:inline으로 남는데, inline
// 요소엔 width/height가 아예 적용되지 않아 원이 아니라 얇은 세로선으로
// 찌그러진다.
function StatusDot({ status }: { status: Tenancy["status"] }) {
  if (status === "영업")
    return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-brand" />;
  if (status === "휴업")
    return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-warn" />;
  return (
    <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border-2 border-muted-foreground" />
  );
}

function MarketRow({ k, v, real }: { k: string; v: string; real?: boolean }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {k}
        {!real && (
          <span className="rounded border border-border px-1 text-[9px] text-muted-foreground">
            예시
          </span>
        )}
      </dt>
      <dd className="mt-0.5 text-sm font-semibold tabular-nums text-navy">{v}</dd>
    </div>
  );
}

function StatsBoard({ detail, current }: { detail: UnitDetail; current: Tenancy | null }) {
  const { statistics, timeline } = detail;
  // 실 timeline 데이터로 계산 가능한 값 — 현재 점유 이력을 제외하고, subCategory가
  // 같은 "확정 폐업" 이력 수. (휴업은 아직 폐업이 아니라서 제외)
  const sameSubCategoryFailures = current
    ? timeline.filter(
        (t) =>
          !isOccupiedStatus(t.status) &&
          t.tenancyId !== current.tenancyId &&
          t.subCategory === current.subCategory,
      ).length
    : 0;

  const selfStats = [
    { label: "폐업 횟수", value: `${statistics.closedCount}회` },
    {
      label: "최장 운영",
      value:
        statistics.longestSurvivalMonths != null ? `${statistics.longestSurvivalMonths}개월` : "-",
    },
    {
      label: "최단 운영",
      value:
        statistics.shortestSurvivalMonths != null
          ? `${statistics.shortestSurvivalMonths}개월`
          : "-",
    },
    {
      label: "동일 업종 실패",
      value: `${sameSubCategoryFailures}회`,
      hint: sameSubCategoryFailures
        ? `현재 업종(${current?.subCategory})은 이 자리에서 과거 ${sameSubCategoryFailures}번 폐업했습니다.`
        : "이 자리에서 동일 업종의 반복 폐업은 관측되지 않았습니다.",
    },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {selfStats.map((it) => (
        <Card key={it.label} className={"rounded-xl border-border/70 bg-surface p-5 shadow-card"}>
          <p className="text-xs text-muted-foreground">{it.label}</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-navy">{it.value}</p>
          {it.hint ? <p className="mt-1 text-xs text-muted-foreground">{it.hint}</p> : null}
        </Card>
      ))}
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
              <label className="-m-2 flex cursor-pointer items-center gap-3 rounded-lg p-2 transition hover:bg-secondary/60">
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
          <h2 className="text-2xl font-bold sm:text-3xl">
            좋은 창업은 여러 자리를 비교하는 것에서 시작됩니다.
          </h2>
          <p className="mt-2 text-sm text-navy-foreground/70">다른 자리와 비교해 보세요.</p>
        </div>
        <Button
          asChild
          size="lg"
          className="rounded-full bg-background text-navy hover:bg-background/90"
        >
          <Link to="/search">
            새로운 자리 분석하기
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-40 rounded-2xl" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}
