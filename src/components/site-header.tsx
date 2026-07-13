import { Link } from "@tanstack/react-router";

// 기본은 sticky(문서 흐름 안에서 64px를 차지) — report/search 등 일반 스크롤
// 페이지는 이 공간이 있어야 본문이 헤더 밑에 깔리지 않는다. 랜딩의 풀페이지
// 스크롤 스냅에서만 흐름 공간을 아예 없애야 각 섹션이 정확히 100dvh를 채우므로
// floating=true로 position: fixed를 쓴다. floating 표면은 검색 페이지의
// 플로팅 브랜드 블록(surface/90 + shadow-lg + blur)과 같은 언어를 쓴다 —
// sticky는 일반 독(dock) 내비게이션이라 계속 border-b만 쓴다.
export function SiteHeader({ floating = false }: { floating?: boolean }) {
  return (
    <header
      className={
        "inset-x-0 top-0 z-30 backdrop-blur " +
        (floating
          ? "fixed bg-surface/90 shadow-lg"
          : "sticky border-b border-border/60 bg-background/80")
      }
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-navy text-navy-foreground text-sm font-semibold">
            터
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="text-[15px] font-semibold tracking-tight text-foreground">터봄</span>
            <span className="text-xs text-muted-foreground">Turbohm</span>
          </span>
        </Link>
      </div>
    </header>
  );
}
