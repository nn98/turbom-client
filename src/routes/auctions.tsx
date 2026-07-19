import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { MOCK_AUCTION_CASES } from "@/lib/api/auction";

export const Route = createFileRoute("/auctions")({
  head: () => ({
    meta: [
      { title: "경매물건 확인 | 터봄" },
      { name: "description", content: "자리 실사와 함께 참고할 수 있는 법원경매 진행 물건 목록." },
    ],
  }),
  component: AuctionsPage,
});

const formatKrw = (n: number) => `${n.toLocaleString("ko-KR")}원`;

function AuctionsPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold tracking-tight text-navy">경매물건 확인</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          자리 실사와 함께 참고할 수 있는 법원경매 진행 물건입니다.
        </p>

        <Alert className="mt-6 border-border/70 bg-surface">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>실 데이터 연동 전 예시입니다</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            아래 물건은 전부 예시 데이터입니다. 실 데이터를 연결하려면 백엔드가 경매 API
            엔드포인트·응답 스키마를 먼저 명세에 추가해야 합니다.
          </AlertDescription>
        </Alert>

        <ol className="mt-8 space-y-4">
          {MOCK_AUCTION_CASES.map((item) => (
            <li key={`${item.caseNumber}-${item.itemNumber}`}>
              <Card className="rounded-xl border-border/70 bg-surface p-6 shadow-card">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-base font-semibold text-navy">
                    {item.caseNumber} · {item.itemNumber}
                  </h2>
                  <Badge
                    variant="outline"
                    className="rounded-full border-border text-[10px] text-muted-foreground"
                  >
                    예시
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.court} {item.divisionName} · {item.propertyType}
                </p>
                <p className="mt-1 text-sm text-foreground">{item.jibunAddress}</p>
                <p className="mt-3 text-sm text-muted-foreground">{item.appraisalSummary}</p>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-muted-foreground">감정가</dt>
                    <dd className="font-medium text-foreground">
                      {formatKrw(item.appraisalValueKrw)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">최저매각가</dt>
                    <dd className="font-medium text-foreground">
                      {formatKrw(item.minimumSalePriceKrw)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">매각기일</dt>
                    <dd className="font-medium text-foreground">{item.saleDate}</dd>
                  </div>
                </dl>

                <Accordion type="single" collapsible className="mt-4">
                  <AccordionItem value="schedule" className="border-border/70">
                    <AccordionTrigger className="text-sm text-muted-foreground hover:no-underline">
                      기일 이력 {item.scheduleHistory.length}건
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="space-y-2">
                        {item.scheduleHistory.map((entry) => (
                          <li
                            key={`${entry.scheduleDate}-${entry.scheduleType}`}
                            className="flex items-center justify-between rounded-lg bg-background px-3 py-2 text-sm"
                          >
                            <span className="text-muted-foreground">
                              {entry.scheduleDate} {entry.scheduleTime} · {entry.scheduleType}
                            </span>
                            <span className="flex items-center gap-2">
                              <span className="text-foreground">
                                {formatKrw(entry.minimumPriceKrw)}
                              </span>
                              <Badge
                                variant="outline"
                                className="rounded-full border-border text-[10px] text-muted-foreground"
                              >
                                {entry.result}
                              </Badge>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </Card>
            </li>
          ))}
        </ol>
      </main>
      <SiteFooter />
    </div>
  );
}
