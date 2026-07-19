# 업데이트 소식 + 경매물건 페이지 신설 — 설계

## 배경

사용자 요청: "백엔드 스펙 변경점 및 추가점, API 및 로그 보고, 경매물건 확인할 페이지"를 지금 스타일에 맞춰 신설. 확인 결과 백엔드엔 이 세 가지를 뒷받침할 API가 전혀 없다 — `SiteController`의 search/site/unit 3개 엔드포인트뿐이고, 경매정보는 `@RestController`에 전혀 연결되지 않은 개발용 스파이크(`server/spec/CHANGELOG.md` 16차, courtauction.go.kr 이용약관 이슈로 실서비스 보류 중)이며, 별도 요청-로그 API도 존재하지 않는다.

사용자와의 스코프 확인(질문/답변):
- 페이지 성격: **일반 사용자 노출**(내부 점검용이 아님) — 검색/보고서와 나란히 정식 화면으로 만든다.
- "백엔드 스펙 변경점/추가점" + "API 및 로그 보고"는 결국 같은 것 — 기존 `.github/workflows/spec-drift-check.yml`이 다루는 영역(`api-spec.md`/`frontend-spec.md` 변경 감지)의 연장선. 사용자가 실제로 원한 건 "API 변경점이랑 체인지로그"였음(리터럴 요청-로그가 아님).
- 경매물건: 목업으로 우선 채우되, 백엔드 `AuctionCase`/`AuctionScheduleEntry` 레코드 필드와 1:1로 맞춰 나중에 교체 가능하게 하고, 스펙이 부족하면 백엔드가 먼저 보충하도록 안내 문구를 넣는다.

## 채택 접근

### 1. `/updates` — "업데이트 소식"

- `server/spec/CHANGELOG.md`·루트 `spec/CHANGELOG.md`(두 사본이 11~15차 구간에서 서로 드리프트돼 있음 — `ter-view/CLAUDE.md`에 이미 기록된 기존 이슈, 이번 작업에서 새로 발견한 건 아님)의 실제 항목들을 사용자가 이해할 수 있는 말로 다듬어 `src/lib/updates-data.ts`에 정적 배열로 큐레이션한다.
- **"n차" 내부 번호는 노출하지 않는다** — 두 사본 간 번호가 어긋나 있어(예: server 11차 ≠ root 11차, 서로 다른 변경사항) 사용자에게 그대로 보여주면 오해를 준다. 날짜 + 평문 제목만 쓴다.
- 선정 항목(날짜순, 실제 CHANGELOG 내용 기반 — 지어내지 않음):
  - 2026-07-19: 법원경매 데이터 연동 개발 착수(내부 검증 단계, 아직 서비스 미노출) — `/auctions` 페이지의 "예시" 배지와 자연스럽게 연결됨
  - 2026-07-18: 데이터 범위를 서울특별시 전체 + 경기도 성남시로 확대
  - 2026-07-18: 무점포·자가신고형 업종을 별도로 분리해 표기
  - 2026-07-18: 물건이 없는 자리를 검색 결과에서 제외
  - 2026-07-17: 폐업일자 없는 비영업 상태의 생존기간 표시 오류 수정
  - 2026-07-10: 층·호 주소 파싱 정확도 개선(약 89% HIGH 신뢰도)
  - 2026-07-10: 주변 상권 정보에 전체 점포 수·업종 구성 추가
- 각 항목: `date`, `title`, `tag`("데이터 확장" | "기능 추가" | "버그 수정"), `summary`(1~2문장, 평문).
- 라이브 API 호출 없음 — 빌드타임 정적 콘텐츠. CHANGELOG가 갱신되면 이 배열도 수동 동기화(기존 `docs/spec/*.md` 미러와 동일한 수동 동기화 컨벤션).
- 화면: report 페이지의 `Card`/`Badge` 스타일 재사용, 날짜순 리스트.

### 2. `/auctions` — "경매물건 확인"

- 백엔드 `com.nextstep.domain.auction.AuctionCase`/`AuctionScheduleEntry` 레코드 필드를 1:1로 그대로 미러링한 TS 타입을 `src/lib/api/auction.ts`(신규)에 정의:
  ```ts
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
  ```
  → 나중에 백엔드가 `GET /api/auctions` 같은 엔드포인트를 열면, 이 페이지는 목업 배열을 `fetch` 호출로 교체하기만 하면 되는 구조.
- 목업 사례 2~3건(현실적인 성남시 수정구 상가 경매 예시로 작성, `src/lib/mock-data.ts` 또는 신규 `src/lib/auction-mock-data.ts`).
- 페이지 상단 고정 안내 배너(`Alert` 또는 카드): "법원경매 정보는 아직 실 연동 전 예시입니다. 실 데이터를 연결하려면 백엔드가 공개 API 명세(`api-spec.md`)에 경매 엔드포인트·스키마를 먼저 추가해야 합니다." — `report.$storeId.tsx`의 `marketInfo.isPlaceholder` 배지와 동일한 시각 언어("예시" Badge)를 카드별로도 적용.
- 화면: 리스트 or 그리드로 사건번호·소재지·감정가·최저매각가·매각기일 카드 표시, 클릭 시 상세(스케줄 이력) 펼침 — `Accordion` 또는 기존 `Card` 확장 패턴 재사용.

### 3. 내비게이션

- `src/components/site-header.tsx`에 로고 옆 nav 링크 2개 추가: "업데이트", "경매물건". 기존엔 로고 링크만 있고 nav가 없었음 — 첫 nav 링크 추가.

### 4. 스펙 교차 기록 (사용자 명시 요청 — "프론트/백 각각의 스펙에 잘 정리")

- **프론트(`ter-view`)**: 이 스펙 문서(본 파일) + `CLAUDE.md`에 "업데이트/경매물건 페이지는 정적·목업 데이터 기반이며 백엔드 API에 의존하지 않는다"는 사실과 두 CHANGELOG 사본 드리프트를 새 콘텐츠 큐레이션에 어떻게 반영했는지 기록.
- **백엔드(`server`)**: `server/spec/CHANGELOG.md`에 교차 기록(미커밋, 백엔드 세션 검토 대기) — "프론트가 `/updates`(CHANGELOG 요약 정적 페이지)와 `/auctions`(AuctionCase 필드 1:1 목업) 페이지를 추가했다. 경매물건 실 연동을 원하면 `api-spec.md`에 엔드포인트·스키마를 먼저 추가해달라"는 요청을 명시.

## 하지 않는 것 (명시적 스코프 제외)

- 백엔드에 실제 `/api/auctions` 등 신규 엔드포인트 추가 — 이 레포(`ter-view`) 소관 밖이고, courtauction.go.kr 이용약관 이슈로 백엔드 스스로도 보류 중.
- CHANGELOG.md를 파싱해 자동으로 `/updates` 콘텐츠를 생성하는 빌드 파이프라인 — 내용이 백엔드 내부 구현 세부(Java 클래스명·힙 설정 등)를 다수 포함해 사용자에게 그대로 노출 불가, 수동 큐레이션이 더 간단하고 정확함.
- 두 CHANGELOG 사본(루트 vs `server/`) 간 드리프트 자체를 고치는 것 — 기존에 이미 알려진 백엔드 이슈, 이번 스코프 밖.
- `spec-drift-check.yml` 워크플로우 확장 — 사용자가 이미 있는 것의 "연장선" 성격이라고 언급했을 뿐, 그 워크플로우 자체(GitHub Issue 생성)를 건드리진 않는다. `/updates` 페이지는 별도의 정적 콘텐츠 페이지다.

## 검증 계획

- `npx tsc --noEmit && npx vitest run` 통과.
- 개발 서버(포트 8080 유지)에서 `/updates`, `/auctions` 실제 방문해 렌더링 확인, `SiteHeader` nav 링크 클릭 이동 확인.
- 경매 카드의 "예시" 배지·안내 배너가 실제로 보이는지 스크린샷 확인.
