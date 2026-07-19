// 법원경매 정보. 백엔드엔 이 화면을 뒷받침할 API가 없다 — server 레포의
// AuctionCase/AuctionScheduleEntry(com.nextstep.domain.auction)는 개발용
// 스파이크로만 존재하고 어떤 @RestController에도 연결돼 있지 않다
// (courtauction.go.kr 이용약관 이슈로 보류, server/spec/CHANGELOG.md 16차).
//
// 아래 타입은 그 두 레코드의 필드를 1:1로 미러링한다 — 백엔드가 나중에
// GET /api/auctions 같은 엔드포인트를 열면, 이 파일의 MOCK_AUCTION_CASES를
// 그 응답으로 교체하기만 하면 화면(auctions.tsx)은 고칠 필요가 없다.
// 근거: docs/superpowers/specs/2026-07-19-updates-and-auctions-pages-design.md

export interface AuctionScheduleEntry {
  scheduleDate: string;
  scheduleTime: string;
  scheduleType: string;
  location: string;
  minimumPriceKrw: number;
  result: string;
}

export interface AuctionCase {
  caseNumber: string;
  itemNumber: number;
  court: string;
  divisionName: string;
  propertyType: string;
  jibunAddress: string;
  appraisalValueKrw: number;
  minimumSalePriceKrw: number;
  bidDepositKrw: number;
  biddingMethod: string;
  saleDate: string;
  filedDate: string;
  auctionStartDate: string;
  claimDeadline: string;
  claimAmountKrw: number;
  appraisalSummary: string;
  scheduleHistory: AuctionScheduleEntry[];
}

export const MOCK_AUCTION_CASES: AuctionCase[] = [
  {
    caseNumber: "2025타경48213",
    itemNumber: 1,
    court: "수원지방법원 성남지원",
    divisionName: "경매 3계",
    propertyType: "근린상가",
    jibunAddress: "경기도 성남시 수정구 태평동 4310-2",
    appraisalValueKrw: 480_000_000,
    minimumSalePriceKrw: 307_200_000,
    bidDepositKrw: 30_720_000,
    biddingMethod: "기일입찰",
    saleDate: "2026-08-26",
    filedDate: "2025-11-03",
    auctionStartDate: "2025-11-20",
    claimDeadline: "2025-12-22",
    claimAmountKrw: 260_000_000,
    appraisalSummary: "철근콘크리트조 4층 건물 중 1층 상가 전체, 태평역 도보 6분",
    scheduleHistory: [
      { scheduleDate: "2026-05-27", scheduleTime: "10:00", scheduleType: "매각기일", location: "성남지원 2호 법정", minimumPriceKrw: 480_000_000, result: "유찰" },
      { scheduleDate: "2026-07-01", scheduleTime: "10:00", scheduleType: "매각기일", location: "성남지원 2호 법정", minimumPriceKrw: 384_000_000, result: "유찰" },
      { scheduleDate: "2026-08-26", scheduleTime: "10:00", scheduleType: "매각기일", location: "성남지원 2호 법정", minimumPriceKrw: 307_200_000, result: "진행 예정" },
    ],
  },
  {
    caseNumber: "2025타경51877",
    itemNumber: 2,
    court: "서울중앙지방법원",
    divisionName: "경매 7계",
    propertyType: "집합건물(상가)",
    jibunAddress: "서울특별시 강남구 역삼동 736-15",
    appraisalValueKrw: 1_250_000_000,
    minimumSalePriceKrw: 1_250_000_000,
    bidDepositKrw: 125_000_000,
    biddingMethod: "기일입찰",
    saleDate: "2026-09-09",
    filedDate: "2026-01-15",
    auctionStartDate: "2026-02-02",
    claimDeadline: "2026-03-10",
    claimAmountKrw: 890_000_000,
    appraisalSummary: "지하철 2호선 역삼역 인근 오피스 빌딩 지하 1층 상가, 전용 82.4㎡",
    scheduleHistory: [
      { scheduleDate: "2026-09-09", scheduleTime: "10:30", scheduleType: "매각기일", location: "서울중앙지법 4별관 경매법정", minimumPriceKrw: 1_250_000_000, result: "진행 예정" },
    ],
  },
  {
    caseNumber: "2026타경5031",
    itemNumber: 1,
    court: "수원지방법원 성남지원",
    divisionName: "경매 1계",
    propertyType: "근린상가",
    jibunAddress: "경기도 성남시 중원구 상대원동 111-9",
    appraisalValueKrw: 215_000_000,
    minimumSalePriceKrw: 105_350_000,
    bidDepositKrw: 10_535_000,
    biddingMethod: "기일입찰",
    saleDate: "2026-07-29",
    filedDate: "2025-09-11",
    auctionStartDate: "2025-09-25",
    claimDeadline: "2025-11-02",
    claimAmountKrw: 190_000_000,
    appraisalSummary: "상대원공단 인접 3층 근린생활시설 2층 일부호, 전용 34.1㎡",
    scheduleHistory: [
      { scheduleDate: "2026-04-08", scheduleTime: "10:00", scheduleType: "매각기일", location: "성남지원 3호 법정", minimumPriceKrw: 215_000_000, result: "유찰" },
      { scheduleDate: "2026-05-13", scheduleTime: "10:00", scheduleType: "매각기일", location: "성남지원 3호 법정", minimumPriceKrw: 172_000_000, result: "유찰" },
      { scheduleDate: "2026-06-17", scheduleTime: "10:00", scheduleType: "매각기일", location: "성남지원 3호 법정", minimumPriceKrw: 137_600_000, result: "유찰" },
      { scheduleDate: "2026-07-29", scheduleTime: "10:00", scheduleType: "매각기일", location: "성남지원 3호 법정", minimumPriceKrw: 105_350_000, result: "진행 예정" },
    ],
  },
];
