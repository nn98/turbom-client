import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  Building2,
  Database,
  Layers,
  MapPin,
  Search,
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

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <Hero />
        <SearchBand />
        <KeyFeatures />
        <WhyTurbohm />
        <AnalysisInfo />
      </main>
      <SiteFooter />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-70"
        style={{
          background:
            "radial-gradient(60% 50% at 20% 20%, oklch(0.95 0.04 155 / 0.5), transparent 60%), radial-gradient(50% 50% at 100% 0%, oklch(0.9 0.03 260 / 0.4), transparent 60%)",
        }}
      />
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:px-8 lg:py-24">
        <div className="flex flex-col justify-center">
          <Badge
            variant="outline"
            className="w-fit gap-2 rounded-full border-brand/40 bg-brand-soft px-3 py-1 text-brand-foreground text-xs font-medium"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            <span className="text-navy">창업자를 위한 입지 실사 리포트</span>
          </Badge>
          <h1 className="mt-6 text-balance text-5xl font-bold leading-[1.1] tracking-tight text-navy sm:text-6xl lg:text-[68px]">
            자리를 보면,
            <br />
            창업이 보입니다.
          </h1>
          <p className="mt-6 max-w-xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg">
            좋은 창업은, 좋은 자리를 보는 것에서 시작됩니다. 계약하려는 바로 그 자리의 과거
            개업·폐업 이력과 생존 통계를 분석하여 계약 전에 필요한 판단 근거를 제공합니다.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              size="lg"
              className="rounded-full bg-navy px-6 text-navy-foreground hover:bg-navy/90"
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

        <div className="relative lg:pl-4">
          <PreviewReportCard />
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
      className="scroll-mt-20 border-y border-border/60 bg-surface-muted/60"
    >
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-xs font-medium tracking-wider text-brand uppercase">Address Search</p>
          <h2 className="mt-2 text-2xl font-semibold text-navy sm:text-3xl">
            지번 주소로 시작하세요
          </h2>
        </div>
        <form
          className="mt-6 flex flex-col gap-2 sm:flex-row"
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
              className="h-14 rounded-full border-border bg-background pl-11 pr-4 text-base shadow-sm focus-visible:ring-brand"
            />
          </div>
          <Button
            type="submit"
            size="lg"
            className="h-14 rounded-full bg-navy px-8 text-navy-foreground hover:bg-navy/90"
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
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
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
    </section>
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
    <section className="border-t border-border/60 bg-surface-muted/50">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <p className="text-sm font-medium text-brand">왜 터봄인가</p>
        <h2 className="mt-3 max-w-3xl text-balance text-3xl font-bold tracking-tight text-navy sm:text-4xl">
          상권을 보기 전에, 자리를 봅니다.
        </h2>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {cards.map((c) => (
            <Card key={c.no} className="rounded-2xl border-border/70 bg-surface p-8 shadow-card">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-sm font-semibold text-navy">
                {c.no}
              </span>
              <h3 className="mt-6 text-lg font-semibold text-navy">{c.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{c.desc}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function AnalysisInfo() {
  const rows = [
    { k: "운영 이력", v: "지번 내 해당 상가에서 운영된 모든 업종과 상호" },
    { k: "운영 기간", v: "각 업종이 얼마나 오래 운영되었는지" },
    { k: "폐업 통계", v: "몇 번의 폐업이 있었는지, 어떤 업종에서 반복되었는지" },
    { k: "업종 적합성", v: "지금 창업하려는 업종이 이 자리에서 반복 실패한 업종인지" },
    { k: "현재 상태", v: "현재 어떤 업종이, 얼마나 오래 운영되고 있는지" },
    { k: "계약 체크리스트", v: "계약 전에 반드시 확인할 항목" },
  ];
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <p className="text-sm font-medium text-brand">제공하는 분석 정보</p>
      <h2 className="mt-3 max-w-3xl text-balance text-3xl font-bold tracking-tight text-navy sm:text-4xl">
        하나의 자리, 여섯 가지 각도.
      </h2>
      <Card className="mt-10 overflow-hidden rounded-2xl border-border/70 bg-surface shadow-card">
        <ul className="divide-y divide-border/70">
          {rows.map((r) => (
            <li
              key={r.k}
              className="grid grid-cols-1 gap-2 px-6 py-5 sm:grid-cols-[220px_1fr] sm:items-center sm:gap-6"
            >
              <span className="text-sm font-semibold text-navy">{r.k}</span>
              <span className="text-sm text-muted-foreground">{r.v}</span>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}

// suppress unused imports (kept for reference in header nav)
void Building2;
