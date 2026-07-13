export interface ScrollMetrics {
  scrollLeft: number;
  scrollWidth: number;
  clientWidth: number;
}

// 서브픽셀 반올림 오차 때문에 정확히 0 / scrollWidth-clientWidth로 비교하면
// 오탐(끝에 도달했는데도 화살표가 안 사라짐 등)이 잦아 1px 여유를 둔다.
export function edgeScrollState(metrics: ScrollMetrics): {
  canScrollLeft: boolean;
  canScrollRight: boolean;
} {
  const { scrollLeft, scrollWidth, clientWidth } = metrics;
  return {
    canScrollLeft: scrollLeft > 1,
    canScrollRight: scrollLeft + clientWidth < scrollWidth - 1,
  };
}
