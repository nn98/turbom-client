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

    // 마우스 휠(세로 델타)은 가로 전용 스크롤 컨테이너를 기본적으로 안 움직인다
    // — 트랙패드의 가로 제스처(deltaX 우세)는 그대로 두고, 세로 휠일 때만
    // scrollLeft로 변환한다. 스크롤할 여지가 없으면 페이지 자체 스크롤을
    // 막지 않도록 preventDefault를 호출하지 않는다.
    function onWheel(e: WheelEvent) {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      if (el!.scrollWidth <= el!.clientWidth) return;
      e.preventDefault();
      el!.scrollLeft += e.deltaY;
    }
    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      el.removeEventListener("wheel", onWheel);
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
