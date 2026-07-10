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

| 페이지 | 설명 |
| --- | --- |
| 랜딩 (`/`) | Hero · 지번 검색 · 특징 · 왜 터봄인가 · 제공 정보 · CTA |
| 검색 (`/search?q=...`) | 지번 → 부번 그룹 → 층·호 목록 · Leaflet 지도 |
| 리포트 (`/report/:storeId`) | 요약 · 종합 분석 · 상권 · 위험도 · 인사이트 · 타임라인 · 통계 · 체크리스트 |

- 데모 모드: API 없이 Mock Data 기반으로 동일한 사용자 경험 제공
- 반응형 (Mobile / Tablet / Desktop)
- 지도: **Leaflet + CARTO Light 타일** (API 키 불필요, 추후 Naver Maps SDK로 교체 예정)

---

## 3. 기술 스택 (Tech Stack)

- **Framework**: React 19 + TypeScript + TanStack Start (SSR)
- **Routing**: TanStack Router (file-based)
- **Data**: TanStack Query
- **UI**: Tailwind CSS v4 + shadcn/ui
- **Icons**: lucide-react
- **Map**: Leaflet + OpenStreetMap/CARTO (키 불필요)
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
│   ├── map-view.tsx         # Leaflet wrapper
│   └── ui/                  # shadcn/ui
├── lib/
│   ├── mock-data.ts         # Mock DB + searchByJibun / buildReport
│   └── utils.ts
└── styles.css               # Design tokens (Navy · White · Green)
```

---

## 6. 데이터 설계 개요 (Domain Model)

프론트엔드는 `src/lib/mock-data.ts`의 도메인 타입을 기준으로 동작합니다. 실제 API 연결 시 아래 타입 계약만 유지하면 화면 변경 없이 교체 가능합니다.

```ts
Store {
  id, jibunBase, jibunFull, buildingName, roadAddress,
  floor, unit, currentCategory, currentMonths,
  matched: "상가API 매칭" | "추정 분리" | "공실",
  status: "영업" | "공실",
  history: StoreHistory[]
}

StoreHistory { period, start, end, category, brand, months, current? }

AddressSearchResult {
  jibunBase, groups: JibunGroup[], storesByJibun: Record<jibunFull, Store[]>
}

AnalysisReport {
  store, observationYears,
  summary: { riskLevel, riskLabel, closureCount, avgSurvivalMonths, currentCategory, currentMonths, sameCategoryCount, nearbyStoreCount },
  narrative: string[],
  district: { composition, competitionScore, stats, tags },
  insights, stats: { self, area }, checklist
}
```

### 데이터베이스 로직 원칙

- DB 계층은 원자적 CRUD/조회만 담당한다.
- 비즈니스 로직(위험도 계산, 요약 생성, 인사이트 추출 등)은 **Edge Function**에서 처리한다.
- 프론트는 서비스 레이어(`searchByJibun`, `buildReport`)를 통해서만 데이터를 소비한다.

현재는 인메모리 Mock 사용. 추후 IndexedDB/localStorage로 확장하거나 실제 API로 교체 시 `src/lib/mock-data.ts`의 함수 시그니처만 유지하면 됩니다.

---

## 7. 사용자 흐름

```
랜딩 → 지번 주소 입력(본번) → 부번 그룹 조회
     → 층·호 목록 → 상가 선택 → 리포트 → 계약 여부 판단
```

---

## 8. 향후 개선 계획 (Future Work)

- [ ] 공공데이터 인허가 API 실연동 (Edge Function 경유)
- [ ] Naver Maps SDK 전환 (사용자 API 키 입력·수정 UI 포함)
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
