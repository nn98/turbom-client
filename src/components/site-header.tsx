import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-navy text-navy-foreground text-sm font-semibold">
            터
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="text-[15px] font-semibold tracking-tight text-foreground">터봄</span>
            <span className="text-xs text-muted-foreground">Turbohm</span>
          </span>
        </Link>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="text-sm text-muted-foreground hover:text-foreground">
            <Link to="/search">자리 분석</Link>
          </Button>
          <Button asChild size="sm" className="bg-navy text-navy-foreground hover:bg-navy/90 rounded-full px-4">
            <Link to="/search" search={{ q: "성남시 수정구 신흥동 123", demo: true }}>
              데모 보기
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
