// 기본은 문서 흐름에 남는 일반 footer(report 등 보통 스크롤 페이지용).
// floating=true면 헤더와 짝을 맞춰 하단에 고정된 얇은 바로 띄운다 — 랜딩의
// 풀페이지 스냅에서 푸터를 별도 스냅 "페이지"로 두면 그 페이지만 내용에 비해
// 훨씬 커서 빈 공간이 남기 때문에, 아예 흐름/스냅 대상에서 빼고 상시 노출한다.
export function SiteFooter({ floating = false }: { floating?: boolean }) {
  if (floating) {
    return (
      <footer className="fixed inset-x-0 bottom-0 z-20 h-8 border-t border-border/60 bg-background/80 text-[11px] text-muted-foreground backdrop-blur">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-center gap-x-2 px-4 text-center sm:justify-between sm:px-6 lg:px-8">
          <p>© 2026 터봄 Turbohm</p>
          <p className="hidden sm:block">
            인허가 신고 데이터 기준 · 실제 영업 현황과 차이가 있을 수 있습니다
          </p>
        </div>
      </footer>
    );
  }
  return (
    <footer className="border-t border-border/60 bg-surface-muted/60">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>© 2026 터봄 Turbohm · 공공데이터 기반 입지 실사 리포트</p>
        <p>인허가 신고 데이터 기준 · 실제 영업 현황과 차이가 있을 수 있습니다</p>
      </div>
    </footer>
  );
}
