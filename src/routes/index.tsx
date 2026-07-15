import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Building2,
  ClipboardCheck,
  Clock,
  Database,
  History,
  Layers,
  MapPin,
  Search,
  Store,
  Target,
  TrendingDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { DEMO_ADDRESSES } from "@/lib/mock-data";

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

const SECTION_IDS = ["hero", "address-search", "why-turbohm", "analysis-info"] as const;

function LandingPage() {
  const mainRef = useRef<HTMLElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const sections = SECTION_IDS.map((id) => document.getElementById(id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            const idx = SECTION_IDS.indexOf(entry.target.id as (typeof SECTION_IDS)[number]);
            if (idx !== -1) setActiveIndex(idx);
          }
        }
      },
      { root: mainRef.current, threshold: 0.6 },
    );
    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const isLast = activeIndex === SECTION_IDS.length - 1;

  return (
    <div className="flex h-screen flex-col bg-background">
      <SiteHeader />
      <main ref={mainRef} className="flex-1 snap-y snap-mandatory overflow-y-auto scroll-smooth">
        <Hero />
        <SearchBand />
        <WhyTurbohm />
        <AnalysisInfo />
      </main>
      <ScrollCue
        targetId={isLast ? SECTION_IDS[0] : SECTION_IDS[activeIndex + 1]}
        label={isLast ? "맨 위로" : "더 알아보기"}
        direction={isLast ? "up" : "down"}
        tone={activeIndex === 1 ? "light" : "dark"}
      />
    </div>
  );
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function ScrollCue({
  targetId,
  label,
  direction,
  tone,
}: {
  targetId: string;
  label: string;
  direction: "down" | "up";
  tone: "light" | "dark";
}) {
  return (
    <button
      type="button"
      onClick={() => scrollToId(targetId)}
      className={`fixed bottom-6 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-1 text-xs font-semibold transition ${
        tone === "light"
          ? "text-white/70 hover:text-white"
          : "text-muted-foreground hover:text-navy"
      }`}
    >
      {label}
      <svg
        viewBox="0 0 24 24"
        className={`h-4 w-4 motion-safe:animate-bounce ${direction === "up" ? "rotate-180" : ""}`}
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
    <section
      id="hero"
      className="relative flex min-h-full snap-start flex-col justify-center overflow-hidden"
    >
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 50% at 20% 20%, oklch(0.95 0.04 155 / 0.6), transparent 60%), radial-gradient(50% 50% at 100% 0%, oklch(0.9 0.03 260 / 0.5), transparent 60%), radial-gradient(40% 40% at 80% 100%, oklch(0.95 0.04 155 / 0.35), transparent 60%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "linear-gradient(oklch(0.55 0.02 260 / 0.06) 1px, transparent 1px), linear-gradient(90deg, oklch(0.55 0.02 260 / 0.06) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(70% 70% at 50% 40%, black, transparent)",
        }}
      />
      <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:px-8 lg:py-16">
        <div className="flex flex-col justify-center" data-reveal="1">
          <Badge
            variant="outline"
            className="w-fit gap-2 rounded-full border-brand/40 bg-brand-soft px-3 py-1 text-brand-foreground text-xs font-medium"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            <span className="text-navy">창업자를 위한 입지 실사 리포트</span>
          </Badge>
          <h1 className="mt-6 text-5xl font-bold leading-[1.08] tracking-tight text-navy sm:text-6xl lg:text-[76px]">
            자리를 보면,
            <br />
            창업이 보입니다.
          </h1>
          <span className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            좋은 창업은, 좋은 자리를 보는 것에서 시작됩니다. <br />
            계약하려는 바로 그 자리의 과거 개업·폐업 이력과 <br />
            생존 통계를 분석하여 계약 전에 필요한 판단 근거를 제공합니다.
          </span>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              size="lg"
              className="h-12 rounded-full bg-navy px-7 text-navy-foreground shadow-elevated transition-transform duration-300 hover:-translate-y-0.5 hover:bg-navy/90"
              onClick={() => scrollToId("address-search")}
            >
              자리 분석하기
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 rounded-full border-border bg-background/80 px-7 text-navy transition-transform duration-300 hover:-translate-y-0.5 hover:border-brand/50 hover:bg-brand-soft"
              onClick={() => scrollToId("why-turbohm")}
            >
              터봄이 하는 일
            </Button>
          </div>
          <p className="mt-5 text-xs text-muted-foreground">
            공공데이터 기반 · 지번 주소 하나로 시작합니다
          </p>
        </div>

        <div className="relative lg:pl-4" data-reveal="2">
          <div
            className="pointer-events-none absolute -inset-8 -z-10 rounded-full opacity-60 blur-3xl"
            style={{ background: "oklch(0.95 0.04 155)" }}
          />
          <div className="rotate-1 transition-transform duration-700 ease-out hover:rotate-0">
            <PreviewReportCard />
          </div>
        </div>
      </div>
    </section>
  );
}

function PreviewReportCard() {
  return (
    <Card className="relative rounded-2xl border-border/70 bg-surface p-6 shadow-elevated">
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
        <h3 className="text-xl font-semibold text-navy">1층 102호 · 상가 리포트</h3>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <MiniMetric label="위험도" value={<StarRow filled={4} />} note="위험" />
        <MiniMetric
          label="최근 9년 폐업"
          value={<span className="text-2xl font-bold text-navy">4회</span>}
        />
        <MiniMetric
          label="평균 생존기간"
          value={<span className="text-2xl font-bold text-navy">21개월</span>}
        />
        <MiniMetric
          label="현재 업종"
          value={<span className="text-lg font-semibold text-navy">치킨집 · 41개월</span>}
        />
      </div>

      <div className="mt-5 rounded-xl border border-warn/30 bg-warn-soft/60 p-4">
        <p className="text-sm text-navy">
          <span className="font-semibold">카페 업종 반복 폐업</span>
          <span className="text-muted-foreground">
            {" "}
            — 이 자리에서 카페는 최근 5년간 3회 폐업했습니다. 카페 창업은 신중한 검토가 필요합니다.
          </span>
        </p>
      </div>
    </Card>
  );
}

function MiniMetric({
  label,
  value,
  note,
}: {
  label: string;
  value: React.ReactNode;
  note?: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-background p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-2">{value}</div>
      {note ? <p className="mt-1 text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}

function StarRow({ filled }: { filled: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= filled ? "text-danger" : "text-border"} aria-hidden>
          ★
        </span>
      ))}
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
    <section
      id="address-search"
      className="relative flex min-h-full snap-start flex-col justify-center overflow-hidden bg-navy"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(50% 60% at 85% 10%, oklch(0.62 0.14 155 / 0.18), transparent 60%), radial-gradient(40% 50% at 10% 90%, oklch(0.62 0.14 155 / 0.1), transparent 60%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(oklch(1 0 0 / 0.05) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0 / 0.05) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(70% 70% at 50% 50%, black, transparent)",
        }}
      />
      <div className="relative mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div data-reveal="1">
          <h2 className="text-3xl font-bold tracking-tight text-navy-foreground sm:text-5xl">
            지번 주소 하나로,
            <br />그 자리의 이력을 봅니다.
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/60 sm:text-base">
            계약을 고민 중인 상가의 지번 주소를 입력하면 해당 자리의 개업·폐업·생존 통계 리포트가
            열립니다.
          </p>
        </div>
        <form
          className="mt-8 flex flex-col gap-3 sm:flex-row"
          data-reveal="2"
          onSubmit={(e) => {
            e.preventDefault();
            submit(q);
          }}
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="분석할 상가의 지번 주소를 입력하세요"
              className="h-16 rounded-full border-transparent bg-white pl-12 pr-4 text-base text-navy shadow-elevated focus-visible:ring-brand"
            />
          </div>
          <Button
            type="submit"
            size="lg"
            className="h-16 rounded-full bg-brand px-10 text-base font-semibold text-white shadow-elevated transition-transform duration-300 hover:-translate-y-0.5 hover:bg-brand/90"
          >
            검색
          </Button>
        </form>
        <div className="mt-6 flex flex-wrap items-center gap-2 text-xs" data-reveal="3">
          <span className="text-white/50">데모 지번:</span>
          {DEMO_ADDRESSES.map((addr) => (
            <button
              key={addr}
              type="button"
              onClick={() => submit(addr)}
              className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-white/80 transition hover:border-brand/60 hover:bg-white/10 hover:text-white"
            >
              {addr}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function KeyFeatures() {
  const items = [
    { label: "공공데이터", value: "인허가 기반", icon: Database },
    { label: "지번 단위", value: "동일 지번 내 전체 상가", icon: MapPin },
    { label: "층·호 단위", value: "상가별 개별 리포트", icon: Layers },
    { label: "운영 이력", value: "폐업·생존 통계", icon: TrendingDown },
  ];
  return (
    <div className="grid gap-6 border-t border-border/60 pt-8 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(({ label, value, icon: Icon }) => (
        <div key={label} className="flex items-start gap-3">
          <span className="mt-0.5 grid h-9 w-9 place-items-center rounded-lg bg-brand-soft text-brand">
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 text-base font-semibold text-navy">{value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

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
  return (
    <section
      id="why-turbohm"
      className="flex min-h-full snap-start flex-col justify-center border-t border-border/60 bg-surface-muted/50"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div data-reveal="1">
          <p className="text-sm font-semibold text-brand">왜 터봄인가</p>
          <h2 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight text-navy sm:text-5xl">
            상권을 보기 전에,
            <br />
            자리를 봅니다.
          </h2>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3" data-reveal="2">
          {cards.map((c) => (
            <Card
              key={c.no}
              className="group relative overflow-hidden rounded-2xl border-border/70 bg-surface p-7 shadow-card transition-all duration-500 ease-out hover:-translate-y-1.5 hover:border-brand/40 hover:shadow-elevated"
            >
              <span
                className="pointer-events-none absolute -top-5 right-3 select-none text-[96px] font-bold leading-none text-navy/[0.05] transition-colors duration-500 group-hover:text-brand/10"
                aria-hidden
              >
                {c.no}
              </span>
              <span className="block h-1 w-8 rounded-full bg-brand" />
              <h3 className="mt-6 text-lg font-semibold text-navy">{c.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{c.desc}</p>
            </Card>
          ))}
        </div>
        <div className="mt-10" data-reveal="3">
          <KeyFeatures />
        </div>
      </div>
    </section>
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
      icon: Target,
    },
    { k: "현재 상태", v: "현재 어떤 업종이, 얼마나 오래 운영되고 있는지", icon: Store },
    { k: "계약 체크리스트", v: "계약 전에 반드시 확인할 항목", icon: ClipboardCheck },
  ];
  return (
    <section
      id="analysis-info"
      className="relative flex min-h-full snap-start flex-col justify-center"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-16 pb-24 sm:px-6 lg:px-8">
        <div data-reveal="1">
          <p className="text-sm font-semibold text-brand">제공하는 분석 정보</p>
          <h2 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight text-navy sm:text-5xl">
            하나의 자리, 여섯 가지 각도.
          </h2>
        </div>
        <div
          className="mt-10 grid grid-flow-dense gap-4 sm:grid-cols-2 lg:grid-cols-3"
          data-reveal="2"
        >
          {rows.map(({ k, v, icon: Icon }) => (
            <Card
              key={k}
              className="rounded-2xl border-border/70 bg-surface p-6 shadow-card transition-all duration-500 ease-out hover:-translate-y-1 hover:border-brand/40 hover:shadow-elevated"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-navy">{k}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{v}</p>
            </Card>
          ))}
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0">
        <SiteFooter />
      </div>
    </section>
  );
}

// suppress unused imports (kept for reference in header nav)
void Building2;
