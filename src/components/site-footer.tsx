export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-surface-muted/60">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>© 2026 터봄 Turbohm · 공공데이터 기반 입지 실사 리포트</p>
        <p>인허가 신고 데이터 기준 · 실제 영업 현황과 차이가 있을 수 있습니다</p>
      </div>
    </footer>
  );
}
