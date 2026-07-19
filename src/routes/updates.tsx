import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { UPDATE_ENTRIES, type UpdateTag } from "@/lib/updates-data";

export const Route = createFileRoute("/updates")({
  head: () => ({
    meta: [
      { title: "업데이트 소식 | 터봄" },
      { name: "description", content: "터봄 서비스의 최근 데이터·기능 업데이트 이력." },
    ],
  }),
  component: UpdatesPage,
});

const TAG_STYLE: Record<UpdateTag, string> = {
  "데이터 확장": "border-navy/30 text-navy",
  "기능 추가": "border-brand/40 text-brand",
  "버그 수정": "border-border text-muted-foreground",
};

function UpdatesPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold tracking-tight text-navy">업데이트 소식</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          터봄이 최근에 넓힌 조회 범위, 새로 추가한 기능, 고친 표시 오류를 날짜순으로 정리했습니다.
        </p>
        <ol className="mt-8 space-y-4">
          {UPDATE_ENTRIES.map((entry) => (
            <li key={`${entry.date}-${entry.title}`}>
              <Card className="rounded-xl border-border/70 bg-surface p-6 shadow-card">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">{entry.date}</span>
                  <Badge
                    variant="outline"
                    className={`rounded-full text-[10px] ${TAG_STYLE[entry.tag]}`}
                  >
                    {entry.tag}
                  </Badge>
                </div>
                <h2 className="mt-2 text-base font-semibold text-navy">{entry.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{entry.summary}</p>
              </Card>
            </li>
          ))}
        </ol>
      </main>
      <SiteFooter />
    </div>
  );
}
