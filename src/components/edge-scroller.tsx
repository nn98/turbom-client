import { type ReactNode, type RefObject } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEdgeScroll } from "@/hooks/use-edge-scroll";

// 가로 스크롤 컨테이너를 감싸 좌우 끝에 도달했는지에 따라 페이드+화살표를
// 오버레이하는 프레젠테이션 컴포넌트. children은 호출부가 이미
// `no-scrollbar overflow-x-auto`를 걸어 scrollRef를 붙인 실제 스크롤
// 엘리먼트여야 한다 — 이 컴포넌트는 그 위에 겹치는 장식만 그린다.
export function EdgeScroller({
  scrollRef,
  deps = [],
  children,
  fadeClassName = "from-surface",
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
  deps?: unknown[];
  children: ReactNode;
  fadeClassName?: string;
}) {
  const { canScrollLeft, canScrollRight, scrollByStep } = useEdgeScroll(scrollRef, deps);

  return (
    <div className="relative flex min-w-0 flex-1 items-center">
      {canScrollLeft && (
        <>
          <div
            aria-hidden
            className={
              "pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r to-transparent " +
              fadeClassName
            }
          />
          <button
            type="button"
            aria-label="왼쪽으로 스크롤"
            onClick={() => scrollByStep("left")}
            className="edge-nudge-left absolute left-0.5 z-20 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface text-muted-foreground shadow-card transition hover:text-navy"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        </>
      )}
      {children}
      {canScrollRight && (
        <>
          <div
            aria-hidden
            className={
              "pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l to-transparent " +
              fadeClassName
            }
          />
          <button
            type="button"
            aria-label="오른쪽으로 스크롤"
            onClick={() => scrollByStep("right")}
            className="edge-nudge-right absolute right-0.5 z-20 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface text-muted-foreground shadow-card transition hover:text-navy"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );
}
