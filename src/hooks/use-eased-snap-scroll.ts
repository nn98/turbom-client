import { useEffect, type RefObject } from "react";

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// 휠 스크롤만 가로채 자체 이징으로 다음/이전 슬라이드로 넘긴다(터치·키보드는
// 네이티브 scroll-snap 그대로 둔다). 참고 구현(woowaTon/client Home.tsx의
// useEasedSnapScroll)을 그대로 이식 — 섹션에 scroll-margin-top을 두지 않고
// (플로팅 헤더는 position:fixed라 flow 공간을 차지하지 않으므로 필요 없다)
// index*h로만 목표 위치를 계산해도 항상 정확히 맞는다. 이전에 scroll-mt-16
// 보정을 얹었던 버전은 그 보정값 자체가 원인이 되어 네이티브 snap이 한 번 더
// 어긋난 위치를 보정하며 "두 번 넘어가는" 현상을 만들었다.
export function useEasedSnapScroll(ref: RefObject<HTMLDivElement | null>, slideSelector: string) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let busy = false;
    const DURATION = 700;
    const COOLDOWN = 150;

    function animateTo(target: number) {
      busy = true;
      const startTop = el!.scrollTop;
      const distance = target - startTop;
      const t0 = performance.now();
      function step(now: number) {
        const p = Math.min(1, (now - t0) / DURATION);
        el!.scrollTop = startTop + distance * easeInOutCubic(p);
        if (p < 1) requestAnimationFrame(step);
        else setTimeout(() => (busy = false), COOLDOWN);
      }
      requestAnimationFrame(step);
    }

    function onWheel(e: WheelEvent) {
      if (Math.abs(e.deltaY) < 4) return;
      e.preventDefault();
      if (busy) return;
      const h = el!.clientHeight;
      const count = el!.querySelectorAll(slideSelector).length;
      const current = Math.round(el!.scrollTop / h);
      const target = Math.min(count - 1, Math.max(0, current + (e.deltaY > 0 ? 1 : -1)));
      if (target !== current) animateTo(target * h);
    }

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [ref, slideSelector]);
}
