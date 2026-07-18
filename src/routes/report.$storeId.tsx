import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Pie,
  PieChart,
  Rectangle,
  ReferenceArea,
  ReferenceLine,
  Sector,
  XAxis,
  YAxis,
} from "recharts";
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
import type { ChartConfig } from "@/components/ui/chart";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
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
import { EdgeScroller } from "@/components/edge-scroller";
import { RiskBadge } from "@/components/risk-badge";
import { groupSimilarOverlappingTenancies } from "@/lib/tenancy-grouping";
import {
  ApiRequestError,
  buildUnitAnalysis,
  findOccupant,
  isOccupiedStatus,
  RISK_LABELS,
} from "@/lib/api";
import type { RiskLevel, Tenancy, UnitAnalysis, UnitDetail } from "@/lib/api";
import { useUnitDetail } from "@/hooks/use-sites";

const jibunBaseOf = (jibunAddress: string) => jibunAddress.replace(/-\d+$/, "");
// closedAt이 null이라고 해서 무조건 "현재"(지금도 운영 중)는 아니다 — 취소/
// 말소/만료/정지/중지 같은 상태는 인허가 원본에 실제 폐업일자가 안 잡혀
// closedAt이 null로 내려오는 경우가 있다(2026-07-17 실측: 제임스딘(James
// Dean), 4113110800105430000-U1). isOccupiedStatus(영업/휴업)일 때만
// "현재"로 표시하고, 그 외엔 closedAt이 있으면 그 날짜를, 없으면 종료일
// 자체가 확인되지 않는다는 걸 정직하게 "종료일 미상"으로 표시한다.
const endLabelOf = (t: Tenancy): string => {
  if (t.closedAt) return t.closedAt.slice(0, 7);
  return isOccupiedStatus(t.status) ? "현재" : "종료일 미상";
};
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

// 업종 구성 차트 전용 카테고리 팔레트 — navy/brand 등 본문 토큰과 별개다.
// 검증 근거는 styles.css의 --chart-1..6 정의부 주석 참고(2026-07-17,
// dataviz 스킬 validate_palette.js 통과: CVD 인접쌍·명도대·채도 하한 전부 PASS,
// 마젠타/노랑/아쿠아 3개는 대비 3:1 미만이라 항상 텍스트 라벨과 병기).
const CHART_CATEGORY_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
];

type CompositionEntry = { category: string; count: number; ratio: number };

// 카테고리 색 슬롯은 6개뿐(CHART_CATEGORY_COLORS) — 그 이상은 인접 색상을
// 재사용(cycling)하는 대신 하위 항목을 합쳐 "기타"로 접는다(dataviz 스킬:
// "8개 넘는 카테고리 hue를 새로 만들지 말고 꼬리를 Other로 접어라").
function foldToChartCategories(composition: CompositionEntry[]): CompositionEntry[] {
  if (composition.length <= CHART_CATEGORY_COLORS.length) return composition;
  const sorted = [...composition].sort((a, b) => b.count - a.count);
  const kept = sorted.slice(0, CHART_CATEGORY_COLORS.length - 1);
  const rest = sorted.slice(CHART_CATEGORY_COLORS.length - 1);
  return [
    ...kept,
    {
      category: "기타",
      count: rest.reduce((sum, c) => sum + c.count, 0),
      ratio: rest.reduce((sum, c) => sum + c.ratio, 0),
    },
  ];
}

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
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <ReportView storeId={storeId} />
      <SiteFooter />
    </div>
  );
}

// 검색 결과 화면(search.tsx)의 오버레이에서도 그대로 재사용한다 — 상세 페이지
// 진입 시 검색 화면을 언마운트하지 않고(스크롤 위치·지도 위치·필터 상태 보존)
// 이 컴포넌트만 위에 새로 띄운 뒤, 뒤로가기로 오버레이만 닫히게 하기 위함.
// SiteHeader/Footer 같은 페이지 크롬은 포함하지 않는다 — 단독 라우트(ReportPage)와
// 오버레이(search.tsx의 ReportOverlay) 각자가 자신에게 맞는 크롬을 씌운다.
export function ReportView({ storeId }: { storeId: string }) {
  const unitQuery = useUnitDetail(storeId);

  if (unitQuery.isLoading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <ReportSkeleton />
      </main>
    );
  }

  if (unitQuery.isError) {
    const notFound =
      unitQuery.error instanceof ApiRequestError && unitQuery.error.code === "UNIT_NOT_FOUND";
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        {notFound ? (
          <>
            <h1 className="text-xl font-semibold text-navy">해당 자리를 찾을 수 없습니다</h1>
            <Button asChild className="mt-6 rounded-lg bg-navy text-navy-foreground hover:bg-navy/90">
              <Link to="/search">다른 자리 찾기</Link>
            </Button>
          </>
        ) : (
          <>
            <AlertTriangle className="mx-auto h-8 w-8 text-danger" />
            <p className="mt-4 text-sm text-danger">{errorMessage(unitQuery.error)}</p>
            <Button variant="outline" className="mt-6 rounded-lg" onClick={() => unitQuery.refetch()}>
              다시 시도
            </Button>
          </>
        )}
      </div>
    );
  }

  const detail = unitQuery.data;
  if (!detail) return null;
  const analysis = buildUnitAnalysis(detail);
  const current = findOccupant(detail.timeline);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumbs detail={detail} />
      <ReportHeader detail={detail} current={current} riskLevel={analysis.riskLevel} />

      <div className="mt-10 space-y-16">
        <Section number="01" title="통계" subtitle="이 자리에서 먼저 확인할 핵심 지표">
          <SummaryGrid detail={detail} analysis={analysis} current={current} />
          <div className="mt-6">
            <StatsBoard detail={detail} current={current} />
          </div>
        </Section>

        <Section number="02" title="운영 이력" subtitle="이 자리를 거쳐간 업종의 시간 흐름입니다.">
          <TimelineCard timeline={detail.timeline} />
        </Section>

        <Section number="03" title="종합 분석" subtitle="운영 이력과 상권 데이터를 함께 해석했습니다">
          <NarrativeCard lines={analysis.narrative} />
        </Section>

        <Section number="04" title="주변 상권 분석" subtitle="주변 경쟁 환경을 시각적으로 정리했습니다">
          <DistrictAnalysis district={analysis.district} />
        </Section>

        <Section number="05" title="위험도" subtitle="여러 신호를 종합한 참고용 등급">
          <RiskCard
            level={analysis.riskLevel}
            label={analysis.riskLabel}
            lowNearbyDensity={analysis.lowNearbyDensity}
          />
        </Section>

        <Section number="06" title="계약 체크리스트" subtitle="계약 전에 반드시 확인해야 하는 항목">
          <ChecklistCard items={analysis.checklist} />
        </Section>
      </div>

      <ReportCta />
    </main>
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
        "relative overflow-hidden rounded-xl border-border/70 bg-surface p-6 shadow-elevated before:absolute before:inset-y-0 before:left-0 before:w-1 sm:p-8 " +
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
        <h1 className="mt-3 font-serif text-3xl font-medium tracking-tight text-navy sm:text-4xl">
          {/* 예전엔 `${displayUnitLabel(...)}) ${businessName}`처럼 라벨 뒤에
              닫는 괄호 하나를 그냥 이어붙였는데, 상세주소를 못 뽑은 물건의
              라벨 자체가 백엔드에서 이미 "단일(상세주소불명)"처럼 괄호로
              끝나는 값이라 "단일(상세주소불명))"로 괄호가 겹쳐 나갔다(실측:
              4113110800105430000-U1, 4113110800105560000-U2). businessName을
              먼저 쓰고 라벨은 그 뒤에 항상 스스로 짝이 맞는 괄호로 감싸면
              라벨 내용이 뭐든 깨지지 않는다. */}
          {current
            ? `${current.businessName} (${displayUnitLabel(unit.label)})`
            : displayUnitLabel(unit.label)}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">{unit.jibunAddress}</p>
      </div>
    </Card>
  );
}

function Section({
  number,
  title,
  subtitle,
  children,
}: {
  number: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <p className="text-xs font-bold tracking-[0.2em] text-brand">SECTION {number}</p>
      <h2 className="mt-1 font-serif text-2xl font-medium tracking-tight text-navy sm:text-3xl">
        {title}
      </h2>
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
    <Card className="rounded-xl border-border/70 bg-surface p-6 shadow-card sm:p-8">
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
  const { isPlaceholder, stats } = district;
  const composition = foldToChartCategories(district.composition);
  const [selectedCategoryName, setSelectedCategoryName] = useState(
    () => composition[0]?.category ?? "",
  );
  const selectedCategory =
    composition.find((c) => c.category === selectedCategoryName) ?? composition[0];
  const competitionScore = selectedCategory ? Math.round(selectedCategory.ratio * 100) : 0;
  const totalCount = composition.reduce((sum, c) => sum + c.count, 0);
  return (
    <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
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
        <p className="mt-1 text-xs text-muted-foreground">
          이 자리 반경 300m 안 상가 {totalCount}곳을 업종별 비중으로 나눈 도넛입니다. 조각이나
          오른쪽 항목을 누르면 아래 경쟁도가 그 업종 기준으로 바뀝니다.
        </p>
        <CompositionDonut
          composition={composition}
          selectedCategory={selectedCategory?.category}
          onSelect={setSelectedCategoryName}
        />
        {isPlaceholder && (
          <p className="mt-3 text-xs text-muted-foreground">실 데이터 연동 전 예시값입니다.</p>
        )}
      </Card>
      <div className="space-y-4">
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
                          onClick={() => setSelectedCategoryName(c.category)}
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
          {/* muted-foreground/70은 11px에서 대비 3.3:1로 WCAG AA(4.5:1) 미달 —
            불투명 muted-foreground(6.5:1)로 낮춤. */}
          <p className="mt-1 text-[11px] text-muted-foreground">
            선택한 업종의 반경 300m 내 점포 비중 기준 참고 지표입니다.
          </p>
        </Card>
        <Card className="rounded-xl border-border/70 bg-surface p-6 shadow-card">
          <h3 className="text-base font-semibold text-navy">상권 통계</h3>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <StatRow k="동일 업종" v={String(stats.sameCategory ?? 0)} />
            <StatRow k="전체 점포" v={String(stats.totalStores)} placeholder={isPlaceholder} />
            <StatRow k="집계 기준일" v={stats.referenceDate} />
          </dl>
        </Card>
      </div>
    </div>
  );
}

// "업종 구성"(part-to-whole)은 도넛 차트로 표현한다. dataviz 스킬은 part-to-whole의
// 기본값으로 스택 막대를 권장하지만, pie/donut 금지는 "값이 비슷해 비교가 안 될 때"
// 한정이다(anti-patterns.md: "part-to-whole at a glance only, ≤6 segments"는 허용
// 조건으로 명시돼 있음) — 이 데이터는 33%~9%로 값이 뚜렷이 갈리고 세그먼트도 6개
// 이하라 도넛이 안전하다. 값이 서로 근접해 순위를 가려야 하는 경우라면 막대로
// 되돌린다. 범례는 색만으로 구분하지 않도록 항상 이름·개수·비율 텍스트를 병기.
function CompositionDonut({
  composition,
  selectedCategory,
  onSelect,
}: {
  composition: CompositionEntry[];
  selectedCategory: string | undefined;
  onSelect: (category: string) => void;
}) {
  const total = composition.reduce((sum, c) => sum + c.count, 0);
  const [hoverIndex, setHoverIndex] = useState<number | undefined>(undefined);
  const selectedIndex = composition.findIndex((c) => c.category === selectedCategory);
  // 실제로 강조 표시할(확대된 조각+리더선) 인덱스 — 마우스가 올라가 있는 동안엔
  // 그 조각을, 마우스가 떠나면(hoverIndex undefined) 선택된 업종을 그대로
  // 보여준다. 클릭해서 선택한 뒤에도 마우스를 떼면 강조가 사라지던 문제 수정.
  const activeIndex = hoverIndex ?? (selectedIndex >= 0 ? selectedIndex : undefined);
  const selectedEntry = selectedIndex >= 0 ? composition[selectedIndex] : undefined;
  const chartConfig: ChartConfig = Object.fromEntries(
    composition.map((c, i) => [
      c.category,
      { label: c.category, color: CHART_CATEGORY_COLORS[i % CHART_CATEGORY_COLORS.length] },
    ]),
  );

  // 호버한 조각만 살짝 도려내듯 확대하고, 중심에서 바깥으로 꺾인 리더선을
  // 그어 그 끝에 업종명·개수·비율을 같은 색으로 띄운다(Recharts 공식
  // "Customized active shape" 예제의 sx/sy(선 시작)→mx/my(꺾이는 지점)→
  // ex/ey(라벨 지점) 삼각함수 좌표 계산을 그대로 재사용). 로딩 시 조각이
  // 각도 0에서 실제 각도까지 그려지는 것은 Recharts Pie의 기본 진입
  // 애니메이션(isAnimationActive, 기본값 true)이라 별도 구현이 필요 없다.
  const renderActiveShape = (props: {
    cx?: number;
    cy?: number;
    midAngle?: number;
    innerRadius?: number;
    outerRadius?: number;
    startAngle?: number;
    endAngle?: number;
    fill?: string;
    payload?: unknown;
    percent?: number;
    value?: number;
  }) => {
    const RADIAN = Math.PI / 180;
    const {
      cx = 0,
      cy = 0,
      midAngle = 0,
      innerRadius = 0,
      outerRadius = 0,
      startAngle,
      endAngle,
      fill,
      payload,
      percent = 0,
      value,
    } = props;
    const sin = Math.sin(-RADIAN * midAngle);
    const cos = Math.cos(-RADIAN * midAngle);
    const sx = cx + (outerRadius + 10) * cos;
    const sy = cy + (outerRadius + 10) * sin;
    const mx = cx + (outerRadius + 28) * cos;
    const my = cy + (outerRadius + 28) * sin;
    const ex = mx + (cos >= 0 ? 1 : -1) * 20;
    const ey = my;
    const textAnchor = cos >= 0 ? "start" : "end";
    const entry = payload as CompositionEntry;
    return (
      <g>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
        />
        <Sector
          cx={cx}
          cy={cy}
          startAngle={startAngle}
          endAngle={endAngle}
          innerRadius={outerRadius + 5}
          outerRadius={outerRadius + 9}
          fill={fill}
        />
        <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" strokeWidth={1.5} />
        <circle cx={ex} cy={ey} r={3} fill={fill} stroke="none" />
        <text
          x={ex + (cos >= 0 ? 1 : -1) * 8}
          y={ey - 7}
          textAnchor={textAnchor}
          className="fill-navy text-[15px] font-semibold"
        >
          {entry.category}
        </text>
        <text
          x={ex + (cos >= 0 ? 1 : -1) * 8}
          y={ey + 11}
          textAnchor={textAnchor}
          className="fill-muted-foreground text-[12px]"
        >
          {`${value}개 · ${Math.round(percent * 100)}%`}
        </text>
      </g>
    );
  };

  return (
    // 범례를 원형 그래프 아래 가로 나열 대신 오른쪽에 세로로 둔다 — 항목이
    // 늘어나도(현재는 foldToChartCategories가 6개로 접지만, 팔레트 슬롯이
    // 늘어나 더 많은 카테고리를 그대로 보여주게 되는 경우를 대비) 차트 크기에
    // 맞춰 세로 스크롤만 늘어나고 차트 레이아웃 자체는 흔들리지 않는다.
    // items-center(기존 items-stretch였음)로 바꾼 이유: stretch는 두 자식
    // 중 더 큰 쪽(도넛) 높이에 맞춰 짧은 목록도 강제로 늘려서, 항목이
    // 6개뿐일 때 목록 아래에 아무 의미 없는 빈 여백이 크게 남았다.
    <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <ChartContainer
        config={chartConfig}
        className="mx-auto aspect-square max-h-[320px] w-full sm:mx-0 sm:flex-1"
      >
        <PieChart>
          <Pie
            data={composition}
            dataKey="count"
            nameKey="category"
            innerRadius="34%"
            outerRadius="46%"
            paddingAngle={2}
            stroke="var(--color-surface)"
            strokeWidth={2}
            activeIndex={activeIndex}
            activeShape={renderActiveShape}
            onMouseEnter={(_, index) => setHoverIndex(index)}
            onMouseLeave={() => setHoverIndex(undefined)}
            onClick={(entry) => onSelect((entry as unknown as CompositionEntry).category)}
            className="cursor-pointer"
          >
            {composition.map((c, i) => (
              <Cell
                key={c.category}
                fill={CHART_CATEGORY_COLORS[i % CHART_CATEGORY_COLORS.length]}
                fillOpacity={selectedCategory && selectedCategory !== c.category ? 0.45 : 1}
              />
            ))}
            {/* 다른 조각에 실시간으로 마우스가 올라간 동안(hoverIndex != null)엔
                activeShape가 그 조각의 리더선+라벨로 대체 표시하므로 겹치지
                않게 가운데 라벨을 뺀다. 마우스를 떼면 선택된 업종 기준으로
                되돌아온다 — 선택 자체가 없으면(hoverIndex도 selectedIndex도
                없으면) 전체 합계를 보여준다. */}
            {hoverIndex == null && (
              <Label
                position="center"
                content={({ viewBox }) => {
                  if (!viewBox || !("cx" in viewBox)) return null;
                  const { cx, cy } = viewBox;
                  return (
                    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                      <tspan x={cx} y={cy} className="fill-navy text-3xl font-bold">
                        {selectedEntry?.count ?? total}
                      </tspan>
                      <tspan x={cx} y={(cy ?? 0) + 20} className="fill-muted-foreground text-xs">
                        {selectedEntry ? selectedEntry.category : "개 점포"}
                      </tspan>
                    </text>
                  );
                }}
              />
            )}
          </Pie>
        </PieChart>
      </ChartContainer>
      {/* 범례를 겸하는 클릭 목록 — 색만으로 구분하지 않도록 스와치 옆에 항상
          업종명·개수·비율을 텍스트로 병기한다(마젠타/노랑/아쿠아 슬롯은 배경
          대비가 3:1 미만이라 텍스트 라벨이 없으면 식별 자체가 안 됨). 세로
          목록 + max-h(overflow-y-auto)라 카테고리가 늘어나도 카드 높이가
          아니라 이 목록 내부만 스크롤된다. */}
      <ul className="flex w-full flex-col gap-1 sm:w-48 sm:max-h-[320px] sm:overflow-y-auto sm:border-l sm:border-border/60 sm:pl-4">
        {composition.map((c, i) => (
          <li key={c.category}>
            <button
              type="button"
              onClick={() => onSelect(c.category)}
              className={
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition " +
                (selectedCategory === c.category ? "bg-secondary/60" : "hover:bg-secondary/30")
              }
            >
              <span
                aria-hidden
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ background: CHART_CATEGORY_COLORS[i % CHART_CATEGORY_COLORS.length] }}
              />
              <span className="min-w-0 flex-1 truncate font-medium text-navy">{c.category}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {c.count}개 · {Math.round(c.ratio * 100)}%
              </span>
            </button>
          </li>
        ))}
      </ul>
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

function RiskCard({
  level,
  label,
  lowNearbyDensity,
}: {
  level: RiskLevel;
  label: string;
  lowNearbyDensity: boolean;
}) {
  // 세그먼트 중앙(각 1/5 구간의 가운데)에 현재 단계 마커를 둔다.
  const markerPct = ((level - 0.5) / 5) * 100;
  return (
    <Card className="rounded-xl border-border/70 bg-surface p-8 shadow-card">
      <div className="grid gap-8 lg:grid-cols-[auto_1fr] lg:items-center">
        <div className="text-center">
          <RiskBadge level={level} label={label} />
          <p className="mt-3 text-xs tabular-nums text-muted-foreground">Level {level} / 5</p>
          {/* 배지와 같은 줄에 두면 줄바꿈 여부에 따라 "Level N/5" 텍스트와의
              세로 정렬이 흔들렸다 — 그 아래 별도 줄로 내려 항상 같은
              위치에 고정한다(반경 300m 내 동일 업종이 5개 미만일 때의
              경고, unit-analysis.ts의 lowNearbyDensity 계산 참고). */}
          {lowNearbyDensity && (
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-warn-soft px-2.5 py-1 text-xs font-semibold text-warn">
              <AlertTriangle className="h-3.5 w-3.5" />
              주변 점포가 적습니다
            </span>
          )}
        </div>
        <div>
          <div className="relative">
            <div
              className="h-2 overflow-hidden rounded-full"
              style={{
                background:
                  "linear-gradient(to right, color-mix(in oklch, var(--color-brand) 55%, white), color-mix(in oklch, var(--color-warn) 55%, white), color-mix(in oklch, var(--color-danger) 55%, white))",
              }}
            />
            <div
              aria-hidden
              className="absolute -top-1 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-surface bg-navy shadow-card"
              style={{ left: `${markerPct}%` }}
            />
          </div>
          <div className="mt-3 grid grid-cols-5 text-center text-[11px] text-muted-foreground">
            {([1, 2, 3, 4, 5] as RiskLevel[]).map((l) => (
              <span key={l} className={l === level ? "font-bold text-navy" : ""}>
                {RISK_LABELS[l]}
              </span>
            ))}
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
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="space-y-6">
      <Card className="rounded-xl border-border/70 bg-surface p-4 shadow-card sm:p-6">
        <EdgeScroller scrollRef={scrollRef} deps={[timeline.length]}>
          <div
            ref={scrollRef}
            className="no-scrollbar relative flex gap-3 overflow-x-auto px-1 py-2"
          >
            {/* 카드 뒤 연결선. 화면마다 정확한 위치는 다를 수 있어 Playwright로
                점(StatusDot) 중심과 어긋나는지 확인 후 top 값을 조정할 것. */}
            <div aria-hidden className="absolute inset-x-1 top-[25px] h-px bg-border" />
            {timeline.map((t) => {
              const displayCategory = t.industryDetail ?? t.subCategory;
              return (
                <button
                  key={t.tenancyId}
                  type="button"
                  onClick={() => setSelectedId(t.tenancyId)}
                  className={
                    "relative z-10 flex w-40 shrink-0 flex-col items-start gap-1.5 rounded-xl p-3 text-left transition hover:bg-secondary/40 " +
                    (t.tenancyId === selectedId ? "bg-secondary/50" : "")
                  }
                >
                  <StatusDot status={t.status} />
                  <span className="w-full truncate text-sm font-semibold text-navy">
                    {t.businessName}
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {t.licensedAt.slice(0, 7)} — {endLabelOf(t)}
                  </span>
                  <span className="w-full truncate text-xs text-muted-foreground">
                    {displayCategory}
                  </span>
                </button>
              );
            })}
          </div>
        </EdgeScroller>
      </Card>

      {selected && (
        <Card className="rounded-xl border-border/70 bg-surface p-6 shadow-card sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-navy">가게 자세히 보기</h3>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="w-full rounded-full sm:w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timeline.map((t) => (
                  <SelectItem key={t.tenancyId} value={t.tenancyId}>
                    {t.businessName} ({t.licensedAt.slice(0, 7)} — {endLabelOf(t)})
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
                  v={`${selected.licensedAt.slice(0, 7)} — ${endLabelOf(selected)}`}
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
    { label: "개업 횟수", value: `${statistics.totalTenancyCount}회` },
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
  ];
  return (
    <div className="space-y-3">
      <TenancyHistoryGantt timeline={timeline} />
      <div className="grid gap-3 lg:grid-cols-2">
        <SurvivalRangeMeter
          shortest={statistics.shortestSurvivalMonths}
          average={statistics.averageSurvivalMonths}
          longest={statistics.longestSurvivalMonths}
        />
        <Card className="rounded-xl border-border/70 bg-surface p-5 shadow-card">
          <p className="text-xs text-muted-foreground">동일 업종 실패</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-navy">
            {sameSubCategoryFailures}회
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {sameSubCategoryFailures
              ? `현재 업종(${current?.subCategory})은 이 자리에서 과거 ${sameSubCategoryFailures}번 폐업했습니다.`
              : "이 자리에서 동일 업종의 반복 폐업은 관측되지 않았습니다."}
          </p>
        </Card>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {selfStats.map((it) => (
          <Card key={it.label} className={"rounded-xl border-border/70 bg-surface p-5 shadow-card"}>
            <p className="text-xs text-muted-foreground">{it.label}</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-navy">{it.value}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

const monthsBetween = (fromISO: string, toISO: string): number => {
  const from = new Date(fromISO);
  const to = new Date(toISO);
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
};

// 분기 눈금이 실제 달력 분기(1·4·7·10월 시작)에 맞도록, 원점을 최초 이력의
// 날짜가 아니라 그 날짜가 속한 분기의 시작월로 내림한다.
const quarterAlignedOrigin = (iso: string): Date => {
  const d = new Date(iso);
  const quarterStartMonth = Math.floor(d.getMonth() / 3) * 3;
  return new Date(d.getFullYear(), quarterStartMonth, 1);
};

// 분기 눈금마다 라벨을 다 채우면(10년 기준 40개) 너무 빽빽해지므로, 눈금
// 자체(분기 단위 grid)는 매 분기 그리되 텍스트 라벨은 1분기(연초)에만 표시.
const formatYearTick = (origin: Date, offsetMonths: number): string => {
  const d = new Date(origin.getFullYear(), origin.getMonth() + offsetMonths, 1);
  return d.getMonth() === 0 ? `${d.getFullYear()}` : "";
};

const GANTT_STATUS_COLOR: Record<string, string> = {
  영업: "var(--color-brand)",
  휴업: "var(--color-warn)",
};
const ganttColorOf = (status: string) => GANTT_STATUS_COLOR[status] ?? "var(--color-muted-foreground)";

// closedAt이 없는데 상태도 영업/휴업이 아닌(=지금 점유 중은 아닌) 이력은
// 실제 종료일을 모른다(endLabelOf의 "종료일 미상" 참고). 이 경우 실제
// monthsBetween(licensedAt, now)로 막대를 그리면 "지금까지 이어졌다"는
// 착시가 생긴다 — 폭을 반년(2분기 눈금)짜리 고정 상징 길이로 잘라 "여기서부터
// 알 수 없음"을 명시하고, 페이드아웃 그라데이션으로 그 불확실함을 한 번 더
// 표시한다.
const UNKNOWN_END_DURATION_MONTHS = 6;
const GANTT_UNKNOWN_END_GRADIENT_ID = "ganttUnknownEndFade";
const GANTT_FUTURE_HATCH_ID = "ganttFutureHatch";

type GanttRow = Tenancy & {
  offset: number;
  duration: number;
  hasUnknownEnd: boolean;
  groupId: number | null;
};

// 개업/폐업을 고립된 숫자 비교(막대 2개)로 보여주는 대신, 운영 이력
// 타임라인 자체를 간트차트로 그린다 — 몇 번 개폐업했는지(행 수)뿐 아니라
// 언제·얼마나 오래(막대 위치·길이) 운영했는지, 어떤 상태였는지(색)까지
// 한 그림에서 드러난다. Recharts(this project pins ^2.15) has no native
// floating/range bar — 그 기능은 v3.6부터다 — 그래서 v2 표준 우회 기법인
// "투명 offset 막대 + 보이는 duration 막대"를 같은 stackId로 쌓아 뜬 막대를
// 만든다. 상태 색은 이 파일의 StatusDot과 동일한 의미(영업=브랜드,
// 휴업=warn, 그 외 폐업/취소 등=muted)를 그대로 재사용한다.
function TenancyHistoryGantt({ timeline }: { timeline: Tenancy[] }) {
  if (timeline.length === 0) {
    return (
      <Card className="rounded-xl border-border/70 bg-surface p-5 shadow-card">
        <p className="text-xs text-muted-foreground">개업·폐업 이력</p>
        <p className="mt-3 text-sm text-muted-foreground">운영 이력이 없습니다.</p>
      </Card>
    );
  }
  const now = new Date().toISOString().slice(0, 10);
  // 같은 물건에서 기간이 겹치고 상호명도 사실상 같은(공백/괄호/지점명
  // 접미어 차이 정도) 레코드는 막대는 그대로 각자 두고, 배경 강조로만
  // 시각적으로 묶어 보여준다 — 서로 다른 인허가 레코드로 쪼개졌을 뿐
  // 실제로는 하나의 영업일 가능성이 큰 경우(원 프로젝트 CLAUDE.md의 물건
  // 분리 규칙 D-1과 같은 종류의 데이터 파편화)를 알려주되, 각 레코드의
  // 실제 기간 정보는 잃지 않는다.
  const groupIdOf = groupSimilarOverlappingTenancies(timeline, now);
  const hasGroups = groupIdOf.size > 0;
  const earliestRaw = timeline.reduce(
    (min, t) => (t.licensedAt < min ? t.licensedAt : min),
    timeline[0].licensedAt,
  );
  // 끝점(오른쪽)은 항상 "지금"으로 고정하고, 시작점(왼쪽)은 거기서 최소
  // 10년 전으로 잡는다 — 실제 이력이 10년보다 오래됐으면(earliestRaw가 더
  // 과거) 그만큼 왼쪽으로 늘어난다. 예전엔 원점을 earliestRaw 기준으로만
  // 잡고 최소폭 120개월을 앞으로 채웠는데, 이력이 10년보다 짧으면 "지금"이
  // 축 중간 어딘가에 찍히고 그 뒤로 빈 미래 공간이 남는 문제가 있었다.
  const tenYearsAgo = new Date();
  tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
  const windowStartRaw =
    earliestRaw < tenYearsAgo.toISOString().slice(0, 10)
      ? earliestRaw
      : tenYearsAgo.toISOString().slice(0, 10);
  const originDate = quarterAlignedOrigin(windowStartRaw);
  const origin = originDate.toISOString().slice(0, 10);
  const rows: GanttRow[] = [...timeline]
    .sort((a, b) => b.licensedAt.localeCompare(a.licensedAt))
    .map((t) => {
      const hasUnknownEnd = !isOccupiedStatus(t.status) && !t.closedAt;
      return {
        ...t,
        offset: monthsBetween(origin, t.licensedAt),
        duration: hasUnknownEnd
          ? UNKNOWN_END_DURATION_MONTHS
          : Math.max(1, monthsBetween(t.licensedAt, t.closedAt ?? now)),
        hasUnknownEnd,
        groupId: groupIdOf.get(t.tenancyId) ?? null,
      };
    });
  // 축 오른쪽 끝을 "지금"이 아니라 "올해 12월 말"까지 늘려, 아직 오지 않은
  // 미래 구간을 빗금으로 마스킹해 "오늘" 기준선을 명확히 보여준다(연도를
  // 하드코딩하지 않고 매번 현재 연도 기준으로 계산 — 그래야 해가 바뀌어도
  // 계속 맞는다). nowOffset(오늘 위치)과 totalMonths(축 끝) 사이가 마스킹
  // 대상 구간이다.
  const yearEnd = `${now.slice(0, 4)}-12-31`;
  const nowOffset = monthsBetween(origin, now);
  // origin이 이미 "지금"으로부터 최소 10년 전(또는 그 이상)이라 결과는
  // 항상 120개월 이상이다 — 분기 단위로 올림해 눈금 경계와 맞춘다.
  const totalMonths = Math.ceil(monthsBetween(origin, yearEnd) / 3) * 3;
  const quarterTicks = Array.from({ length: totalMonths / 3 + 1 }, (_, i) => i * 3);
  // 연초(1월)에 해당하는 눈금만 골라 그 자리에 더 진한 "연도 구분선"을 한
  // 겹 더 그린다 — 표준 간트차트(예: dhtmlxGantt, frappe-gantt)가 연/월
  // 경계를 옅은 하위 눈금보다 굵은 선으로 강조하는 것과 같은 관례.
  const yearTicks = quarterTicks.filter((v) => formatYearTick(originDate, v) !== "");
  // 막대 자체는 얇게 줄이고(barSize) 그만큼 왼쪽 라벨 폭을 넓혀 매장명이
  // 잘리지 않게 여유를 준다 — 실제 기간 비율(offset/duration)은 그대로.
  const rowHeight = 26;
  const chartHeight = rows.length * rowHeight + 36;
  const closedCount = timeline.filter((t) => !isOccupiedStatus(t.status)).length;

  const chartConfig: ChartConfig = {
    영업: { label: "영업", color: "var(--color-brand)" },
    휴업: { label: "휴업", color: "var(--color-warn)" },
    기타: { label: "폐업/기타", color: "var(--color-muted-foreground)" },
  };

  return (
    <Card className="rounded-xl border-border/70 bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs text-muted-foreground">개업·폐업 이력(기간) · 분기 단위</p>
        {/* 범례를 차트 위쪽에 둔다 — dhtmlxGantt/frappe-gantt 등 일반적인
            간트차트가 범례를 차트 아래보다 위쪽(제목 옆)에 두는 관례를
            따른다. 스와치도 점(●) 대신 막대 자체를 닮은 작은 사각형으로 —
            이 색이 "막대의 색"이라는 걸 형태로도 알 수 있게. */}
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {(["영업", "휴업", "기타"] as const).map((key) => (
            <span key={key} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span
                aria-hidden
                className="h-2 w-3.5 shrink-0 rounded-sm"
                style={{ background: chartConfig[key].color as string }}
              />
              {chartConfig[key].label as string}
            </span>
          ))}
        </div>
      </div>
      <ChartContainer config={chartConfig} className="mt-3 aspect-auto w-full" style={{ height: chartHeight }}>
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 2, right: 16, bottom: 4, left: 0 }}
          barCategoryGap={4}
        >
          {/* 세로 그리드선을 XAxis와 같은 분기 눈금에 정확히 맞춘다.
              CartesianGrid는 verticalValues를 안 주면 자체적으로 "적당한"
              눈금 개수를 다시 계산해서 그리는데, 그 결과가 XAxis의 커스텀
              분기 눈금(quarterTicks)과 어긋나 "이상하게" 보이는 원인이었다
              — verticalValues로 두 축을 강제로 동기화한다(가로선은 끔 —
              행 구분은 막대 자체로 충분). Recharts는 <CartesianGrid>를
              차트당 하나만 렌더링하므로(renderMap의 once:true — 두 번째
              인스턴스는 조용히 무시됨) 연초(1월) 구분선은 별도로 여러 개
              둘 수 있는 <ReferenceLine>으로 겹쳐 그려 표준 간트차트의
              "연도 구분선"처럼 굵게 강조한다. */}
          <defs>
            {/* 각 막대의 로컬 바운딩박스 기준(0~1) 좌→우로 옅어지는 그라데이션.
                종료일 미상 이력의 막대에만 이 fill을 쓴다. */}
            <linearGradient id={GANTT_UNKNOWN_END_GRADIENT_ID} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--color-muted-foreground)" stopOpacity={1} />
              <stop offset="100%" stopColor="var(--color-muted-foreground)" stopOpacity={0} />
            </linearGradient>
            {/* "오늘" 이후(아직 오지 않은 미래) 구간을 덮는 45도 빗금 패턴. */}
            <pattern
              id={GANTT_FUTURE_HATCH_ID}
              width="6"
              height="6"
              patternTransform="rotate(45)"
              patternUnits="userSpaceOnUse"
            >
              <rect width="6" height="6" fill="var(--color-secondary)" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-border)" strokeWidth="1.5" />
            </pattern>
          </defs>
          <CartesianGrid vertical horizontal={false} verticalValues={quarterTicks} stroke="var(--color-border)" />
          {yearTicks.map((v) => (
            <ReferenceLine key={v} x={v} stroke="var(--color-muted-foreground)" strokeOpacity={0.6} />
          ))}
          {/* 오늘 ~ 축 끝(올해 12월 말)까지를 빗금으로 마스킹해 "여기부터는
              아직 일어나지 않은 미래"임을 보여주고, 그 경계에 "오늘" 기준선을
              점선으로 명확히 긋는다. */}
          {totalMonths > nowOffset && (
            <ReferenceArea
              x1={nowOffset}
              x2={totalMonths}
              fill={`url(#${GANTT_FUTURE_HATCH_ID})`}
              stroke="none"
              ifOverflow="visible"
            />
          )}
          <ReferenceLine
            x={nowOffset}
            stroke="var(--color-navy)"
            strokeDasharray="4 3"
            label={{
              value: "오늘",
              position: "insideTopRight",
              fill: "var(--color-navy)",
              fontSize: 10,
              fontWeight: 600,
            }}
          />
          <XAxis
            type="number"
            domain={[0, totalMonths]}
            ticks={quarterTicks}
            tickFormatter={(v: number) => formatYearTick(originDate, v)}
            tickLine={false}
            axisLine={false}
            height={20}
            tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
          />
          <YAxis
            type="category"
            dataKey="businessName"
            tickLine={false}
            axisLine={false}
            width={132}
            interval={0}
            tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
            tickFormatter={(v: string) => (v.length > 12 ? `${v.slice(0, 12)}…` : v)}
          />
          <ChartTooltip
            cursor={false}
            // 기본은 차트 영역(viewBox) 안에서만 움직이도록 갇혀 있어 왼쪽
            // 라벨 열 근처에서는 툴팁이 뭉개져 보였다 — allowEscapeViewBox로
            // 카드 밖까지도 자유롭게 마우스를 따라가게 푼다.
            allowEscapeViewBox={{ x: true, y: true }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload as GanttRow;
              return (
                <div className="min-w-[200px] rounded-xl border border-border/50 bg-background px-4 py-3 text-sm shadow-xl">
                  <p className="font-semibold text-navy">{row.businessName}</p>
                  <p className="mt-1 text-muted-foreground">
                    {row.licensedAt.slice(0, 7)} — {endLabelOf(row)}
                  </p>
                  <p className="text-muted-foreground">
                    {row.status}
                    {!row.hasUnknownEnd && ` · ${row.duration}개월`}
                  </p>
                  {row.hasUnknownEnd && (
                    <p className="mt-0.5 text-muted-foreground">실제 운영기간은 확인되지 않습니다.</p>
                  )}
                </div>
              );
            }}
          />
          <Bar dataKey="offset" stackId="gantt" fill="transparent" isAnimationActive={false} />
          <Bar
            dataKey="duration"
            stackId="gantt"
            radius={3}
            barSize={12}
            isAnimationActive={false}
            // 병합하지 않고 각 레코드를 그대로 별도 막대로 두되, 기간이 겹치고
            // 상호명도 사실상 같아 같은 그룹으로 묶인 행에는 그 행 전체 폭에
            // 걸친 옅은 배경 + 테두리를 깔아 "이 행들은 같은 영업으로
            // 추정됨"을 시각적으로만 표시한다(groupSimilarOverlappingTenancies
            // 참고). background는 Bar 자체 값과 무관하게 그 행의 전체
            // 트랙(0~축 끝)을 채운다.
            background={(rawProps: unknown) => {
              const props = rawProps as { index?: number };
              const row = rows[props.index ?? 0];
              if (row?.groupId == null) return <Rectangle {...props} fill="transparent" />;
              return (
                <Rectangle
                  {...props}
                  fill="var(--color-brand)"
                  fillOpacity={0.08}
                  stroke="var(--color-brand)"
                  strokeOpacity={0.35}
                  strokeWidth={1}
                  radius={4}
                />
              );
            }}
          >
            {rows.map((row) => (
              <Cell
                key={row.tenancyId}
                fill={row.hasUnknownEnd ? `url(#${GANTT_UNKNOWN_END_GRADIENT_ID})` : ganttColorOf(row.status)}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
      <p className="mt-3 text-xs text-muted-foreground">
        막대 길이가 실제 운영 기간입니다. 총 {timeline.length}번 개업했고, 그중 {closedCount}번
        폐업으로 이어졌습니다.
        {hasGroups &&
          " 배경이 강조된 행은 기간이 겹치고 상호명이 사실상 같아 같은 영업으로 추정되는 이력입니다."}
        {rows.some((r) => r.hasUnknownEnd) &&
          " 옅어지는 막대는 종료일을 알 수 없는 이력으로, 실제 운영기간과 무관한 표시 길이입니다."}
        {totalMonths > nowOffset && " 빗금 표시된 구간은 오늘 이후, 아직 일어나지 않은 미래입니다."}
      </p>
    </Card>
  );
}

// 최단·평균·최장 생존기간을 하나의 막대 위 위치로 보여준다 — RiskCard의
// "트랙 + 마커" 시각언어를 그대로 재사용해 페이지 안에서 일관된 패턴을 쓴다.
function SurvivalRangeMeter({
  shortest,
  average,
  longest,
}: {
  shortest: number | null;
  average: number | null;
  longest: number | null;
}) {
  if (shortest == null || longest == null || longest <= 0) {
    return (
      <Card className="rounded-xl border-border/70 bg-surface p-5 shadow-card">
        <p className="text-xs text-muted-foreground">생존기간 범위</p>
        <p className="mt-4 text-sm text-muted-foreground">
          운영 이력이 충분하지 않아 범위를 계산할 수 없습니다.
        </p>
      </Card>
    );
  }
  // 예전엔 트랙을 0~longest로 고정해서, 최단·최장이 둘 다 longest에
  // 가까우면(값 자체의 폭이 좁으면) 강조 구간과 레이블이 전부 우측
  // 100% 근처로 쏠리며 서로 겹쳤다. 트랙 자체를 실제 값의 범위인
  // shortest~longest로 다시 잡아(0을 원점으로 두지 않음) 최단은 항상
  // 왼쪽 끝, 최장은 항상 오른쪽 끝에 오도록 고쳤다 — 값 폭과 무관하게
  // 항상 트랙 전체를 채워 쓴다.
  const range = longest - shortest;
  const avgPct =
    average != null ? (range > 0 ? Math.min(100, Math.max(0, ((average - shortest) / range) * 100)) : 50) : null;
  return (
    <Card className="rounded-xl border-border/70 bg-surface p-5 shadow-card">
      <p className="text-xs text-muted-foreground">생존기간 범위(최단–최장)</p>
      <div className="relative mt-5 h-2 rounded-full bg-secondary">
        <div aria-hidden className="absolute inset-0 rounded-full bg-brand/40" />
        {avgPct != null && (
          <div
            aria-hidden
            className="absolute -top-1 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-surface bg-navy shadow-card"
            style={{ left: `${avgPct}%` }}
          />
        )}
      </div>
      <div className="relative mt-2 h-4 text-xs tabular-nums text-muted-foreground">
        <span className="absolute left-0">{shortest}개월</span>
        <span className="absolute right-0">{longest}개월</span>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        {average != null
          ? `평균 생존기간은 ${average}개월(●)로, 최단 ${shortest}개월과 최장 ${longest}개월 사이입니다.`
          : `이 자리를 거쳐간 업종의 생존기간은 최단 ${shortest}개월에서 최장 ${longest}개월까지 관측됐습니다.`}
      </p>
    </Card>
  );
}

function ChecklistCard({ items }: { items: { key: string; label: string }[] }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const done = items.filter((i) => checked[i.key]).length;
  const pct = Math.round((done / items.length) * 100);
  return (
    <Card className="rounded-xl border-border/70 bg-surface p-6 shadow-card sm:p-8">
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
    <div className="mt-20 overflow-hidden rounded-xl bg-navy p-10 text-navy-foreground sm:p-14">
      <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-serif text-2xl font-medium sm:text-3xl">
            좋은 창업은 여러 자리를 비교하는 것에서 시작됩니다.
          </h2>
          <p className="mt-2 text-sm text-navy-foreground/70">다른 자리와 비교해 보세요.</p>
        </div>
        <Button
          asChild
          size="lg"
          className="rounded-lg bg-background text-navy hover:bg-background/90"
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
      <Skeleton className="h-40 rounded-xl" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
