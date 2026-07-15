import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  Clock,
  Database,
  History,
  Layers,
  ListChecks,
  MapPin,
  Search,
  ShieldCheck,
  TrendingDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { RiskBadge } from "@/components/risk-badge";
import { ChecklistGraphic, PinPulseGraphic, SkylineGraphic } from "@/components/landing-graphics";
import { DEMO_ADDRESSES } from "@/lib/mock-data";
import { useEasedSnapScroll } from "@/hooks/use-eased-snap-scroll";

const SLIDE_SELECTOR = "main > section";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "터봄 · 자리를 보면, 창업이 보입니다" },
      {
        name: "description",
        content:
          "터봄은 상가 계약 전, 해당 자리의 과거 개업·폐업 이력과 생존 통계를 분석해 계약 판단 근거를 제공하는 예비 창업자용 입지 실사 서비스입니다.",
      },
      { property: "og:title", content: "터봄 · 자리를 보면, 창업이 보입니다" },
      {
        property: "og:description",
        content: "계약 전에 그 자리의 이력을 봅니다. 층·호 단위 운영·폐업·생존 통계 리포트.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

// 4개 섹션을 한 화면씩 스크롤 스냅으로 넘긴다. dvh(동적 뷰포트 높이)를 쓰는
// 이유: vh/min-h-screen은 모바일 브라우저 주소창이 접히고 펴질 때 실제 보이는
// 영역보다 커서 스냅 위치가 어긋난다 — 이게 100dvh가 표준으로 자리잡은 이유.
// 헤더/푸터는 둘 다 문서 흐름에서 완전히 빼서(position: fixed) 오버레이로
// 띄운다 — 흐름에 남아 있으면 그만큼 섹션이 100dvh보다 짧아지거나(헤더가
// 첫 페이지를 밀어냄), 푸터처럼 아주 짧은 여분 콘텐츠가 자기 몫의 "5번째
// 페이지"를 만들어서 그 페이지만 대부분 빈 공간으로 남는 문제가 생긴다.
//
// CSS scroll-snap만으로는 휠 한 틱에도 관성 때문에 섹션 경계를 살짝 넘나들며
// 미세한 잔여 스크롤이 남는다. 휠 이벤트만 자체 이징으로 가로채(터치·키보드는
// 네이티브 snap 그대로) 슬라이드 단위로 딱 떨어지게 고정한다.
function LandingPage() {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEasedSnapScroll(scrollRef, SLIDE_SELECTOR);

  return (
    <div
      ref={scrollRef}
      className="relative isolate h-dvh snap-y snap-mandatory overflow-y-scroll bg-background"
    >
      <SkylineGraphic className="pointer-events-none fixed inset-x-0 bottom-0 -z-10 h-24 w-full text-navy/10 sm:h-32" />
      <SiteHeader floating />
      <main>
        <Hero />
        <SearchBand />
        <WhyTurbohm />
        <AnalysisInfo />
      </main>
      <SiteFooter floating />
    </div>
  );
}

// 각 섹션은 정확히 h-dvh(브라우저 뷰포트 높이)만큼만 차지한다. 내용이 그
// 안에 다 들어가면 "더 알아보기" 힌트가 항상 화면 하단에 바로 보이고, 내용이
// 넘칠 때만(작은 창 높이 등) 섹션 내부 콘텐츠 영역만 자체 스크롤된다 — 섹션
// 자체가 뷰포트보다 커지는 일은 없어서 스크롤스냅 인덱스*h 계산이 항상
// 정확히 맞는다(참고 구현 woowaTon/client Home.tsx와 동일한 패턴).
function SectionShell({
  id,
  className = "",
  children,
  scrollHint,
}: {
  id: string;
  className?: string;
  children: React.ReactNode;
  scrollHint: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={
        "relative flex h-dvh snap-start [scroll-snap-stop:always] flex-col overflow-hidden " +
        className
      }
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
      {scrollHint}
    </section>
  );
}

// 다음/이전(마지막 슬라이드에서는 맨 위로) 섹션으로 유도하는 하단 힌트.
// <a href="#id">가 아니라 scrollIntoView를 직접 호출한다 — TanStack Router가
// 순수 해시 앵커의 기본 스크롤 동작을 가로채 무효화해서(location.hash는
// 바뀌지만 실제 스크롤은 발생하지 않음), 히어로의 "자리 분석하기" 버튼과
// 같은 방식으로 우회했다.
function ScrollHint({ target, isLast = false }: { target: string; isLast?: boolean }) {
  return (
    <button
      type="button"
      onClick={() =>
        document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" })
      }
      className="group relative z-10 flex shrink-0 flex-col items-center gap-1 py-4 text-xs font-semibold text-muted-foreground transition hover:text-navy"
    >
      {isLast ? "맨 위로" : "더 알아보기"}
      <svg
        viewBox="0 0 24 24"
        className={
          "h-4 w-4 transition group-hover:translate-y-0.5 " +
          (isLast ? "rotate-180 group-hover:-translate-y-0.5" : "motion-safe:animate-bounce")
        }
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
  );
}

function Hero() {
  return (
    <SectionShell
      id="hero-section"
      className="isolate"
      scrollHint={<ScrollHint target="address-search" />}
    >
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(55% 50% at 15% 15%, oklch(from var(--color-brand-soft) l c h / 0.9), transparent 62%), radial-gradient(45% 40% at 100% 0%, oklch(from var(--color-brand-soft) l c h / 0.6), transparent 60%)",
        }}
      />
      <div className="section-enter mx-auto my-auto grid w-full max-w-7xl gap-10 px-4 py-10 sm:gap-14 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:gap-20 lg:px-8">
        <div className="flex flex-col justify-center">
          <Badge
            variant="outline"
            className="w-fit gap-2 rounded-full border-brand/40 bg-brand-soft px-3 py-1 text-brand-foreground text-xs font-medium"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            <span className="text-navy">창업자를 위한 입지 실사 리포트</span>
          </Badge>
          <h1 className="mt-5 text-balance text-4xl font-bold leading-[1.05] tracking-tighter text-navy sm:mt-6 sm:text-5xl lg:text-6xl">
            자리를 보면,
            <br />
            <span className="text-brand">창업</span>이 보입니다.
          </h1>
          <p className="mt-5 max-w-xl text-balance text-base leading-relaxed text-muted-foreground sm:mt-6 sm:text-lg">
            좋은 창업은, 좋은 자리를 보는 것에서 시작됩니다. 계약하려는 바로 그 자리의 과거
            개업·폐업 이력과 생존 통계를 분석하여 계약 전에 필요한 판단 근거를 제공합니다.
          </p>
          <div className="mt-7 flex flex-wrap gap-3 sm:mt-8">
            <Button
              size="lg"
              className="bg-navy px-6 text-navy-foreground hover:bg-navy/90"
              onClick={() =>
                document
                  .getElementById("address-search")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            >
              자리 분석하기
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
          <p className="mt-5 text-xs text-muted-foreground">
            공공데이터 기반 · 지번 주소 하나로 시작합니다
          </p>
        </div>

        <div className="relative hidden lg:block lg:pl-4">
          <div className="rotate-1 transition-transform duration-700 ease-out hover:rotate-0">
            <PreviewReportCard />
          </div>
        </div>
      </div>
    </SectionShell>
  );
}

function PreviewReportCard() {
  return (
    <Card className="relative rounded-[2rem] border-border/70 bg-surface p-6 shadow-elevated">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-brand" />
          <span className="text-xs font-medium text-muted-foreground">분석 리포트 · 미리보기</span>
        </div>
        <Badge
          variant="outline"
          className="rounded-full border-border text-[10px] tracking-wider text-muted-foreground"
        >
          SAMPLE
        </Badge>
      </div>

      <div className="mt-6 space-y-1">
        <p className="text-xs text-muted-foreground">성남시 수정구 신흥동 123-4</p>
        <h3 className="text-xl font-extrabold text-navy">1층 102호 · 상가 리포트</h3>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <MiniMetric label="위험도" value={<RiskBadge level={4} label="위험" />} />
        <MiniMetric
          label="최근 9년 폐업"
          value={<span className="text-2xl font-bold tabular-nums text-danger">4회</span>}
        />
        <MiniMetric
          label="평균 생존기간"
          value={<span className="text-2xl font-bold tabular-nums text-navy">21개월</span>}
        />
        <MiniMetric
          label="현재 업종"
          value={<span className="text-lg font-semibold text-brand">치킨집 · 41개월</span>}
        />
      </div>

      <div className="mt-5 rounded-xl border border-warn/30 bg-warn-soft/60 p-4">
        <p className="text-sm text-navy">
          <span className="font-semibold">카페 업종 반복 폐업</span>
          <span className="text-muted-foreground">
            {" "}
            - 이 자리에서 카페는 최근 5년간 3회 폐업했습니다. 카페 창업은 신중한 검토가 필요합니다.
          </span>
        </p>
      </div>
    </Card>
  );
}

function MiniMetric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-2">{value}</div>
    </div>
  );
}

function SearchBand() {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const submit = (query: string) => {
    if (!query.trim()) return;
    navigate({ to: "/search", search: { q: query.trim(), demo: false } });
  };
  return (
    <SectionShell
      id="address-search"
      className="border-y border-border/60 bg-surface-muted/60"
      scrollHint={<ScrollHint target="why-section" />}
    >
      <div className="section-enter mx-auto my-auto w-full max-w-4xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="text-center">
          <PinPulseGraphic className="mx-auto h-16 w-16 text-brand" />
          <p className="mt-4 text-xs font-medium tracking-wider text-brand uppercase">
            Address Search
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-navy sm:mt-3 sm:text-3xl">
            <span className="text-brand">지번 주소</span>로 시작하세요
          </h2>
        </div>
        <form
          className="mt-6 flex flex-col gap-2 sm:mt-8 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            submit(q);
          }}
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="분석할 상가의 지번 주소를 입력하세요"
              className="h-14 rounded-xl border-border bg-background pl-11 pr-4 text-base focus-visible:ring-brand"
            />
          </div>
          <Button
            type="submit"
            size="lg"
            className="h-14 bg-navy px-8 text-navy-foreground hover:bg-navy/90"
          >
            검색
          </Button>
        </form>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs">
          <span className="text-muted-foreground">데모 지번:</span>
          {DEMO_ADDRESSES.map((addr) => (
            <button
              key={addr}
              type="button"
              onClick={() => submit(addr)}
              className="rounded-full border border-border bg-background px-3 py-1.5 text-navy transition hover:border-brand/50 hover:bg-brand-soft"
            >
              {addr}
            </button>
          ))}
        </div>
      </div>
    </SectionShell>
  );
}

// "왜 터봄인가"(3가지 이유) + "핵심 특징"(4가지 사실)을 한 화면에 압축했다 —
// 예전엔 두 개의 풀스크린 섹션이었지만 참고 구현(woowaTon/client)처럼 이유
// 카드 아래 사실 스트립을 붙이는 편이 한 화면 안에서 자연스럽게 읽힌다.
function WhyTurbohm() {
  const cards = [
    {
      no: "01",
      title: "계약 전에 확인합니다",
      desc: "계약서에 서명하기 전에, 그 자리가 어떤 이력을 가지고 있는지 먼저 확인합니다. 임차 이후 알게 되는 리스크를 앞당깁니다.",
    },
    {
      no: "02",
      title: "자리 단위 리포트입니다",
      desc: "상권 분석이 아닌, 계약하려는 바로 그 층·호 단위의 개별 리포트입니다. 옆 호수의 성공은 이 자리의 근거가 아닙니다.",
    },
    {
      no: "03",
      title: "의사결정의 근거를 남깁니다",
      desc: "데이터를 나열하지 않습니다. 계약 여부를 판단할 수 있는 인사이트와 체크리스트를 함께 제공합니다.",
    },
  ];
  const facts = [
    { label: "공공데이터", value: "인허가 기반", icon: Database },
    { label: "지번 단위", value: "동일 지번 내 전체 상가", icon: MapPin },
    { label: "층·호 단위", value: "상가별 개별 리포트", icon: Layers },
    { label: "운영 이력", value: "폐업·생존 통계", icon: TrendingDown },
  ];
  return (
    <SectionShell
      id="why-section"
      className="border-t border-border/60 bg-surface-muted/50"
      scrollHint={<ScrollHint target="analysis-section" />}
    >
      <div className="section-enter mx-auto my-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <p className="text-sm font-medium text-brand">왜 터봄인가</p>
        <h2 className="mt-3 max-w-3xl text-balance text-3xl font-bold tracking-tighter text-navy sm:text-4xl">
          상권을 보기 전에, 자리를 봅니다.
        </h2>
        {/* 균등 3열 카드 행 대신 첫 카드를 넓은 벤토 타일로, 나머지 둘을
            오른쪽에 쌓아 비대칭을 만든다. */}
        <div className="mt-5 grid gap-3 sm:gap-5 lg:grid-cols-[1.3fr_1fr]">
          <Card className="group relative overflow-hidden rounded-[2rem] border-border/70 bg-surface p-4 shadow-card transition-transform duration-500 ease-out hover:-translate-y-1 sm:p-6">
            <span
              className="pointer-events-none absolute -top-3 right-2 select-none text-[72px] font-bold leading-none text-navy/[0.04] transition-colors duration-500 group-hover:text-brand/10"
              aria-hidden
            >
              {cards[0].no}
            </span>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-sm font-semibold text-brand">
              {cards[0].no}
            </span>
            <h3 className="mt-3 text-lg font-semibold text-navy sm:mt-4">{cards[0].title}</h3>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              {cards[0].desc}
            </p>
          </Card>
          <div className="grid gap-3 sm:gap-5">
            {cards.slice(1).map((c) => (
              <Card
                key={c.no}
                className="group relative overflow-hidden rounded-[2rem] border-border/70 bg-surface p-4 shadow-card transition-transform duration-500 ease-out hover:-translate-y-1"
              >
                <span
                  className="pointer-events-none absolute -top-2 right-2 select-none text-[52px] font-bold leading-none text-navy/[0.04] transition-colors duration-500 group-hover:text-brand/10"
                  aria-hidden
                >
                  {c.no}
                </span>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-xs font-semibold text-brand">
                  {c.no}
                </span>
                <h3 className="mt-3 text-sm font-semibold text-navy">{c.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{c.desc}</p>
              </Card>
            ))}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:mt-6 sm:grid-cols-4 sm:gap-4">
          {facts.map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="flex items-start gap-2.5 rounded-2xl border border-border/60 bg-surface/70 p-3"
            >
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">{label}</p>
                <p className="mt-0.5 truncate text-sm font-semibold text-navy">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SectionShell>
  );
}

function AnalysisInfo() {
  const rows = [
    { k: "운영 이력", v: "지번 내 해당 상가에서 운영된 모든 업종과 상호", icon: History },
    { k: "운영 기간", v: "각 업종이 얼마나 오래 운영되었는지", icon: Clock },
    {
      k: "폐업 통계",
      v: "몇 번의 폐업이 있었는지, 어떤 업종에서 반복되었는지",
      icon: TrendingDown,
    },
    {
      k: "업종 적합성",
      v: "지금 창업하려는 업종이 이 자리에서 반복 실패한 업종인지",
      icon: ShieldCheck,
    },
    { k: "현재 상태", v: "현재 어떤 업종이, 얼마나 오래 운영되고 있는지", icon: Activity },
    { k: "계약 체크리스트", v: "계약 전에 반드시 확인할 항목", icon: ListChecks },
  ];
  return (
    <SectionShell id="analysis-section" scrollHint={<ScrollHint target="hero-section" isLast />}>
      <div className="section-enter mx-auto my-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-16 lg:px-8">
        <div className="flex items-start justify-between gap-8">
          <div>
            <p className="text-sm font-medium text-brand">제공하는 분석 정보</p>
            <h2 className="mt-3 max-w-2xl text-balance text-2xl font-bold tracking-tighter text-navy sm:text-3xl">
              하나의 자리, <span className="text-brand">여섯 가지</span> 각도.
            </h2>
          </div>
          <ChecklistGraphic className="hidden h-28 w-24 shrink-0 text-navy/70 lg:block" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-10 sm:gap-5 lg:grid-cols-3">
          {rows.map(({ k, v, icon: Icon }) => (
            <Card
              key={k}
              className="rounded-[2rem] border-border/70 bg-surface p-3 shadow-card sm:p-5"
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-soft text-brand">
                <Icon className="h-4 w-4" />
              </span>
              <h3 className="mt-4 text-sm font-semibold text-navy">{k}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{v}</p>
            </Card>
          ))}
        </div>

        <div className="mt-3 flex flex-col items-start gap-3 rounded-[2rem] bg-navy p-3 text-navy-foreground sm:mt-6 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div>
            <p className="font-semibold">계약 전에, 자리를 먼저 보세요.</p>
            <p className="mt-1 hidden text-sm text-navy-foreground/70 sm:block">
              지번 주소 하나로 시작합니다. 층·호 단위 상가별 리포트를 확인하세요.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() =>
                document
                  .getElementById("address-search")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
              className="rounded-xl bg-navy-foreground px-4 py-2 text-sm font-semibold text-navy transition hover:brightness-95 active:scale-[0.98]"
            >
              자리 분석하기
            </button>
            <Link
              to="/search"
              className="rounded-xl border border-navy-foreground/30 px-4 py-2 text-sm font-semibold text-navy-foreground transition hover:bg-navy-foreground/10 active:scale-[0.98]"
            >
              지도 둘러보기
            </Link>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
