# 터봄 (Turbohm)

> 자리를 보면, 창업이 보입니다.

터봄은 상가 계약 전, 해당 **자리**의 과거 개업·폐업 이력과 생존 통계를 확인할 수 있는 예비 창업자용 **입지 실사 리포트** 서비스입니다. 정부 인허가 공공데이터를 기반으로 층·호 단위로 상가의 운영 이력을 분석해, "이 자리를 계약해도 괜찮을까?"라는 질문에 객관적인 판단 근거를 제공합니다.

---

## 1. 프로젝트 개요 (Overview)

- **프로젝트명**: 터봄 (Turbohm)
- **타겟 사용자**: 예비 창업자 (카페, 음식점 등 오프라인 자영업)
- **목적**: 단순 데이터 조회가 아닌, 계약 결정을 위한 인사이트 제공
- **핵심 원칙**
  - 데이터를 나열하지 말고 인사이트를 먼저 보여준다
  - 사용자는 5초 안에 핵심 판단 지표를 이해할 수 있어야 한다
  - 숫자는 카드(Card)로 시각화한다
  - 금융·정부 데이터 리포트 수준의 신뢰감

---

## 2. 주요 기능 (Features)

| 페이지                      | 설명                                                                       |
| --------------------------- | -------------------------------------------------------------------------- |
| 랜딩 (`/`)                  | Hero · 지번 검색 · 특징 · 왜 터봄인가 · 제공 정보 · CTA                    |
| 검색 (`/search?q=...`)      | 지번 → 부번 그룹 → 층·호 목록 · 카카오 지도                                |
| 리포트 (`/report/:storeId`) | 요약 · 종합 분석 · 상권 · 위험도 · 인사이트 · 타임라인 · 통계 · 체크리스트 |

- 데모 모드: API 없이 Mock Data 기반으로 동일한 사용자 경험 제공
- 반응형 (Mobile / Tablet / Desktop)
- 지도: **카카오 지도(Kakao Maps) JS SDK** (JavaScript 키 필요, `.env`의 `VITE_KAKAO_MAP_JS_KEY`로 설정)

---

## 3. 기술 스택 (Tech Stack)

- **Framework**: React 19 + TypeScript + TanStack Start (SSR)
- **Routing**: TanStack Router (file-based)
- **Data**: TanStack Query
- **UI**: Tailwind CSS v4 + shadcn/ui
- **Icons**: lucide-react
- **Map**: 카카오 지도(Kakao Maps) JS SDK (JavaScript 키 필요)
- **Charts**: Recharts (필요 시)
- **Build**: Vite 7

---

## 4. 설치 및 실행 (Installation / Run)

```bash
bun install
bun run dev       # 개발 서버
bun run build     # 프로덕션 빌드
bun run preview   # 빌드 결과 미리보기
```

---

## 5. 폴더 구조 (Directory Structure)

```
src/
├── routes/
│   ├── __root.tsx           # 루트 레이아웃 + 메타
│   ├── index.tsx            # 랜딩
│   ├── search.tsx           # 검색
│   └── report.$storeId.tsx  # 리포트
├── components/
│   ├── site-header.tsx
│   ├── site-footer.tsx
│   ├── map-view.tsx         # 카카오 지도 wrapper (VITE_KAKAO_MAP_JS_KEY 필요)
│   └── ui/                  # shadcn/ui
├── hooks/
│   └── use-sites.ts         # TanStack Query 훅 (useSiteSearch/useSiteDetail/useUnitDetail)
├── lib/
│   ├── api/                 # 백엔드 계약 레이어 — routes/hooks는 이 폴더만 import한다
│   │   ├── types.ts         # docs/spec/api-spec.md를 그대로 미러링한 응답 타입
│   │   ├── client.ts        # VITE_API_BASE_URL 유무로 mock/real 전환하는 공개 엔트리포인트
│   │   ├── real-client.ts   # 실 백엔드 fetch 구현
│   │   ├── mock-client.ts   # mock-data.ts를 API 계약 모양으로 변환해 서빙
│   │   ├── legacy-adapter.ts # mock-data.ts(Store/StoreHistory) → api 타입(Tenancy 등) 변환
│   │   ├── tenancy.ts       # Tenancy[] 순수 헬퍼(findOccupant, isOccupiedStatus)
│   │   ├── unit-analysis.ts # 백엔드 계약에 없는 프론트 전용 분석(riskLevel/narrative/체크리스트)
│   │   ├── errors.ts        # ApiRequestError + 에러 코드별 생성 함수
│   │   └── index.ts         # 공개 re-export (routes/hooks는 "@/lib/api"만 import)
│   ├── mock-data.ts         # 데모 모드 원본 데이터셋(legacy-adapter.ts가 소비)
│   └── utils.ts
└── styles.css               # Design tokens (Navy · White · Green)
```

---

## 6. 데이터 설계 개요 (Domain Model)

프론트엔드는 `src/lib/api/types.ts`의 타입을 기준으로 동작한다. 이 타입은 `docs/spec/api-spec.md`(터봄 서버 레포의 계약)를 그대로 미러링한 것이며, 로컬 사본과 원본이 어긋나면 `.github/workflows/spec-drift-check.yml`이 이슈로 알려준다 — 자세한 규칙은 레포 루트의 `CLAUDE.md` 참고.

```ts
SearchResponse { candidates: Candidate[] }
Candidate { pnu, jibunAddress, roadAddress, latitude, longitude, unitCount, closedCount }

SiteDetail { site, units: UnitSummary[], disclaimer }
UnitSummary { unitId, label, currentBusinessName, currentStatus: "영업"|"공실", ... }

UnitDetail { unit, statistics, timeline: Tenancy[], disclaimer }
Tenancy { tenancyId, businessName, category, subCategory, status, marketInfo, ... }
```

**목/실 전환**: `VITE_API_BASE_URL` 미설정 = 데모 모드(`mock-client.ts`가 `mock-data.ts`를 계약 모양으로 변환해 서빙). 설정 시 `real-client.ts`가 그 값으로 실 백엔드를 호출한다 — 어느 쪽이든 라우트/컴포넌트 코드는 `src/lib/api`의 동일한 타입만 본다(`client.ts` 참고).

**그레이존 분석**: 위험도(riskLevel)·종합 분석(narrative)·상권 구성(district)·체크리스트는 백엔드 계약(`UnitDetail`)에 없는 값이다. `src/lib/api/unit-analysis.ts`가 `UnitDetail`을 받아 프론트엔드에서만 계산하며, 실측 가능한 필드(`marketInfo.categoryBreakdown` 등)가 있으면 그걸 쓰고 없으면 데모용 고정값으로 폴백한다.

---

## 7. 사용자 흐름

```
랜딩 → 지번 주소 입력(본번) → 부번 그룹 조회
     → 층·호 목록 → 상가 선택 → 리포트 → 계약 여부 판단
```

---

## 8. 향후 개선 계획 (Future Work)

- [ ] 공공데이터 인허가 API 실연동 (Edge Function 경유)
- [x] Naver Maps SDK 전환 (`.env`의 `VITE_NAVER_MAP_CLIENT_ID`)
- [ ] 사용자가 직접 지도 API 키를 입력·수정할 수 있는 UI (현재는 `.env` 설정만 지원)
- [ ] 리포트 PDF 내보내기
- [ ] 후보지 비교(A/B) 기능
- [ ] IndexedDB 기반 검색 이력 · 즐겨찾기
- [ ] 실 데이터 기반 위험도 산정 모델

---

## 9. 디자인 원칙

- 컬러: **Navy · White · Green** (신뢰 + 데이터 리포트)
- 세리프 지양, 도구적 sans-serif
- 카드 기반 정보 시각화, 과도한 애니메이션 금지
- Semantic token만 사용 (`src/styles.css`)
