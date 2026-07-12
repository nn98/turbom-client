import { useEffect, type RefObject } from "react";

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// 휠 스크롤만 가로채 자체 이징으로 다음/이전 슬라이드로 넘긴다(터치·키보드는
// 네이티브 scroll-snap 그대로 둔다 — 참고 구현(woowaTon/client)과 동일한 절충).
// slideSelector로 고른 요소들의 개수·순서를 슬라이드 목록으로 삼는다.
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
