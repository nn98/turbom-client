import { Link } from "@tanstack/react-router";

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
      </div>
    </header>
  );
}
