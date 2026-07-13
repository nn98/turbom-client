import { useEffect, useState, type RefObject } from "react";
import { edgeScrollState } from "@/lib/edge-scroll";

const SCROLL_STEP_PX = 160;

// deps는 목록 길이 등 스크롤 가능 폭에 영향을 주는 값을 넘겨받아, 컨테이너
// 자체 리사이즈 없이 자식 개수만 바뀌는 경우에도 재계산되게 한다(SegmentedTabs의
// "+N개" 펼침, TimelineCard의 이력 개수 등).
export function useEdgeScroll(ref: RefObject<HTMLElement | null>, deps: unknown[] = []) {
  const [state, setState] = useState({ canScrollLeft: false, canScrollRight: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () =>
      setState(
        edgeScrollState({
          scrollLeft: el.scrollLeft,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
        }),
      );
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const scrollByStep = (direction: "left" | "right") => {
    ref.current?.scrollBy({
      left: direction === "right" ? SCROLL_STEP_PX : -SCROLL_STEP_PX,
      behavior: "smooth",
    });
  };

  return { ...state, scrollByStep };
}
