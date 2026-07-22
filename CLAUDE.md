# CLAUDE.md — 터봄(Turbohm) 클라이언트 레포 규칙

이 레포(`turbom-client`, 프론트엔드)가 지켜야 할 스펙 범위와 정합성 규칙을 못박는 문서.

## 1. 스펙 소스

2026-07-19(스펙 통합)부터 스펙 원본은 독립 저장소 [`nn98/turbom-spec`](https://github.com/nn98/turbom-spec)(public)에 있다. 이 레포는 그중 다음 두 개만 규범으로 삼는다:

- `api-spec.md` — 프론트-백 연동 계약(요청/응답 스키마)
- `frontend-spec.md` — 프론트 단독 명세

그 외(`backend-spec.md`, `schema.sql`, 인허가/상가API 파이프라인 문서 등)는 백엔드(`turbom-server`) 소관이며 이 레포는 참조하지 않는다. (이전에 있던 `spec/` 전체 사본 폴더는 `turbom-server`/`turbom-spec` 어디에도 문서화되지 않은 비공식 사본이었어서 제거했다 — 아래 §2의 `docs/spec/`만 공식 미러다.)

**이 레포에서 백엔드에 알려야 할 발견사항(버그, 스펙-실측 차이 등)을 찾으면 여기 CLAUDE.md에만 적어두지 말고 `../turbom-spec/CHANGELOG.md`에도 직접 교차 기록하고 커밋+push까지 끝낸다.** 예전엔 `server/spec/CHANGELOG.md`(비공식 사본)에 적어두는 관례였는데, 그게 며칠씩 미커밋 상태로 방치되다가 2026-07-19 스펙 통합 때 겨우 복구된 전례가 있다(`turbom-spec/CHANGELOG.md` 17차 참고) — "기록은 해뒀으니 나중에 정리되겠지"가 반복해서 실패했으니 그 자리에서 바로 push까지 한다.

## 2. 로컬 미러

위 두 파일은 `docs/spec/api-spec.md`, `docs/spec/frontend-spec.md`로 로컬에 동기화되어 있다 — 원본 파일명 그대로, 내용은 원본과 바이트 단위로 동일하게 유지한다(로컬에서 직접 수정하지 않는다). 코드 주석에서 이 계약을 가리킬 땐 반드시 `docs/spec/api-spec.md` 경로를 쓴다.

## 3. 정합성 원칙

현재 정상 동작하는 코드가 기준선이다. 스펙과 코드가 어긋나면:

1. 실제 배포 백엔드(`https://turbom.duckdns.org`, `.env.local`의 `VITE_API_BASE_URL`)를 호출해 실제 응답을 확인한다.
2. 케이스별로 어느 쪽을 갱신할지 판단한다 — "무조건 코드를 스펙에 맞춘다"가 원칙이 아니다.
3. 미러 사본(`docs/spec/*.md`)은 원본 그대로 두고, 코드가 스펙보다 실측을 우선한 경우 아래 "알려진 스펙-실측 차이"에 기록한다.

## 4. 스펙 드리프트 자동 감지

`.github/workflows/spec-drift-check.yml`이 매일 1회(+수동 실행)로 `turbom-spec`(2026-07-19부터 스펙 원본 저장소, 이전엔 `turbom-server`의 `spec/`를 봤음)의 `api-spec.md`, `frontend-spec.md`를 로컬 미러와 비교한다. 다르면 `spec-drift` 라벨의 이슈를 새로 열거나(이미 열려있으면 코멘트로) 갱신한다. GitHub Actions만 쓰고 외부 유료/LLM API 호출은 없다.

## 5. 알려진 스펙-실측 차이

### `Tenancy.status`

`api-spec.md`는 `"영업" | "폐업" | "휴업"` 3값만 선언하지만, 실 배포 백엔드는 인허가 원본 상태값을 정규화 없이 그대로 내려줄 때가 있다. 2026-07-11, 성남시 수정구 12개 동·515개 물건·1298개 이력 샘플 실측:

| status 값                | 건수 | 비율  |
| ------------------------ | ---- | ----- |
| 폐업                     | 658  | 50.7% |
| 영업                     | 570  | 43.9% |
| 취소/말소/만료/정지/중지 | 39   | 3.0%  |
| 제외/삭제/전출           | 29   | 2.2%  |
| 휴업                     | 2    | 0.2%  |

**처리**: `영업`/`휴업`이 아니면 전부 "폐업과 동등"하게 취급한다. `src/lib/api/tenancy.ts`의 `isOccupiedStatus()`가 이 판정의 유일한 창구이며, `Tenancy.status`의 타입은 `"영업" | "휴업" | (string & {})`로 넓혀 실제 응답과 타입이 어긋나지 않게 했다(`src/lib/api/types.ts`).

### 상가API 보강(`enrichmentSource: "sangga_api"`)이 실 배포에서 전혀 관측되지 않음

`api-spec.md`는 `units[].industryDetail`/`timeline[].marketInfo.categoryBreakdown`/`totalStoreCount`/`sameCategoryNearbyCount`가 상가API 동단위·반경 매칭으로 채워진다고 명시하지만, 2026-07-16 실측(성남시 수정구 3개 동·영업 중인 유닛 6곳 — 금토동 1곳, 신흥동 1곳, 창곡동 4곳)에서 **6/6 전부** `enrichmentSource: "license_only"`, `industryDetail: null`, `marketInfo.categoryBreakdown: []`, `marketInfo.totalStoreCount: null`, `marketInfo.sameCategoryNearbyCount: null`이었다.

**2026-07-22 재검증 — 부분 해소**: `timeline[].marketInfo.totalStoreCount`/`categoryBreakdown`/`sameCategoryNearbyCount`(반경 300m 조회)는 실측 재확인 결과 실값으로 채워지고 있다(예: 운중동 1034 지하1층 유닛 — `totalStoreCount: 128`, `categoryBreakdown` 8개 항목; turbom-spec CHANGELOG 21차에 "실값인데 문서 누락"으로 이미 기록돼 있었음). 반면 `units[].industryDetail`/`enrichmentSource`는 여전히 `null`/`"license_only"`로 남아있다 — 즉 **반경 상권조회(marketInfo)는 동작하지만, 동단위 업종 상세 매칭(industryDetail)은 여전히 안 됨**. 두 파이프라인이 서로 다른 것으로 확인됨. `src/lib/api/unit-analysis.ts`의 `isPlaceholder` 판정은 `categoryBreakdown` 실측 여부만으로 계산해 이미 올바르게 동작하고 있었다(코드 수정 불필요, 위 코멘트만 갱신).

**영향**: `업종 구성`(district.composition) 카드는 이제 실측 데이터가 있는 물건은 실값을, 없는 경우(공실 등)만 `FALLBACK_COMPOSITION`으로 폴백한다.

### `units[]`(검색·건물상세 물건목록)엔 `category`/`subCategory`가 없음 — `industryDetail`뿐

`api-spec.md` 245번째 줄 근처에 명시된 "세 업종 필드 구분: `category`(대분류, 필수) → `subCategory`(소분류, 필수) → `industryDetail`(상가API 세부, 있으면 우선)" 3단 폴백은 `timeline[]`(물건 상세, `/api/units/{unitId}`)에만 적용된다. `units[]` 필드표(같은 문서 105번째 줄 근처)엔 `industryDetail`만 있고 `category`/`subCategory`는 스펙에도, 실제 `/api/sites/{pnu}` 응답에도 없다(2026-07-16 실측 확인). **여전히 유효** — 2026-07-22 갱신 이후에도 `category`/`subCategory` 자체는 추가되지 않았다.

**2026-07-22 부분 개선**: 검색 결과(`/api/sites/search`)의 `candidates[]`에 `units[]`(축약판 — `unitId`/`parsedFloor`/`parsedUnitNo`/`parseConfidence` 4필드만, `src/lib/api/types.ts`의 `CandidateUnit`) 신규 추가(turbom-spec CHANGELOG 22차, 프론트 요청 반영). 자리마다 상세 API를 추가 호출하지 않고도 층/호 단위로 재분리할 수 있게 됐지만 **업종(category/subCategory)은 여전히 후보 레벨의 `currentSubCategory` 하나뿐**이라, 유닛별 업종 라벨은 이 필드만으로는 못 채운다. 같이 요청했던 `buildingId`(동일 건물 판별 키)는 보류됨 — 아래 PNU 산여부 항목 참고.

**영향**: 검색 결과 리스트(`search.tsx`의 `UnitList`)는 물건 상세처럼 "industryDetail 없으면 subCategory로 폴백" 표시를 할 수 없다 — 폴백할 데이터 자체가 이 API 레이어에 안 내려온다. **근본 해결은 백엔드가 `units[]` 응답에 `category`(또는 `subCategory`)를 추가하는 것**(인허가 원본에서 바로 만들 수 있는 값이라 상가API 보강과 무관하게 항상 채울 수 있음) — 프론트에서 유닛별로 `/api/units/{unitId}`를 추가 호출해 우회하는 건 리스트 하나 그리려고 N번의 추가 API 콜이 나가 권장하지 않는다.

### 신설 화면 — `/updates`(업데이트 소식), `/auctions`(경매물건) — 둘 다 백엔드 API 미의존, 정적/목업 데이터

2026-07-19, 사용자 요청("백엔드 스펙 변경점·API 변경로그 보고 + 경매물건 확인 페이지")으로 신설. 설계 근거는 `docs/superpowers/specs/2026-07-19-updates-and-auctions-pages-design.md` 참고.

- **`/updates`**: `turbom-spec/CHANGELOG.md`(2026-07-19 스펙 통합 이전엔 `server/spec/CHANGELOG.md`)의 실제 항목을 사용자가 읽을 수 있는 평문으로 큐레이션해 `src/lib/updates-data.ts`에 정적 배열로 하드코딩. **"n차" 내부 번호는 화면에 노출하지 않는다** — 두 CHANGELOG 사본 간 번호가 실제로 다른 변경사항을 가리키는 경우가 있어(예: 두 사본의 "11차"가 서로 다른 항목) 그대로 보여주면 사용자에게 오해를 준다. 라이브 API 호출 없음 — CHANGELOG가 갱신되면 이 배열은 수동으로 다시 동기화해야 한다(`docs/spec/*.md` 미러와 동일한 수동 동기화 컨벤션).
- **`/auctions`**: 백엔드에 이 기능을 위한 엔드포인트가 전혀 없다(`server`의 `AuctionCase`/`AuctionScheduleEntry`는 어떤 `@RestController`에도 연결되지 않은 개발용 스파이크 — courtauction.go.kr 이용약관 이슈로 보류 중, `turbom-spec/CHANGELOG.md` 16차). 그래서 `src/lib/api/auction.ts`에 그 백엔드 레코드 필드를 1:1로 미러링한 TS 타입만 정의하고, 목업 데이터로 채운 뒤 카드마다 "예시" Badge(`report.$storeId.tsx`의 `marketInfo.isPlaceholder` 패턴과 동일)와 "백엔드가 `api-spec.md`에 경매 엔드포인트를 먼저 추가해야 한다"는 안내 배너를 넣었다. **백엔드가 실제 엔드포인트를 열면 이 페이지가 손댈 곳은 목업 배열 자리의 `fetch` 호출 하나뿐**이도록 타입을 미리 맞춰뒀다.
- 두 화면 모두 실 API에 의존하지 않으므로, 위에 나열된 "알려진 스펙-실측 차이" 항목들과는 성격이 다르다(실측 대비 코드 정정이 아니라, 애초에 없는 API를 정적 콘텐츠/목업으로 대체한 신규 화면).

### (해결됨, 2026-07-22) 서로 다른 `pnu`가 동일한 `jibunAddress` 텍스트를 공유하는 경우가 있다 — 지도 마커가 "축소 시 2개, 확대 시 1개"로 보이는 원인

실측(2026-07-18, `경기도 성남시 수정구 금토동 534-8`): `pnu` `4113111600005340008`(일반 지번)과 `4113111600105340008`(11번째 자릿수만 다름 — PNU 구조상 산여부 플래그로 추정, 즉 "산 534-8")가 완전히 동일한 `jibunAddress: "경기도 성남시 수정구 금토동 534-8"`, 완전히 동일한 `latitude`/`longitude`로 응답된다. 백엔드가 jibunAddress 문자열을 만들 때 "산" 접두어(또는 다른 구분 표기)를 반영하지 않는 것으로 보인다 — 이 자체는 백엔드 데이터 이슈로 남겨둠(프론트에서 지어낼 수 있는 값이 아님).

**영향과 조치**: 좌표가 완전히 같아 지도가 축소 상태(클러스터)에서는 "2"로 뭉쳐 보이다가, 확대해 클러스터가 풀려도 두 마커가 정확히 같은 픽셀 위치에 겹쳐 "1개"처럼 보인다. 더 심각한 프론트 버그를 같이 발견해 수정함: `search.tsx`/`site-markers.ts`가 "선택된 자리"를 `jibunAddress` 문자열로 식별하고 있었는데, 위 경우 두 후보가 텍스트까지 동일해 `.find()`가 항상 첫 번째만 찾고 두 번째 후보는 탭을 눌러도 선택할 수 없었다(활성 마커 표시도 둘 다 동시에 active가 되거나 안 되거나 했음). `pnu`(항상 고유)를 식별자로 바꿔 수정 — URL 검색 파라미터도 `jibun`→`pnu`로 개명(`selectJibun`→`selectSite`). `MapMarker.jibunAddress` 필드는 더 이상 아무도 안 읽어서 함께 제거.

**후속 조사(2026-07-18)**: 이 케이스를 계기로 "검색결과에서 서로 다른 pnu가 같은 자리로 보이면 시각적으로 묶어줄 수 있는가"를 검토했다(`docs/superpowers/specs/2026-07-18-site-entity-similarity-design.md` 참고). 결론은 **프론트에서 지오+문자열 유사도 휴리스틱으로 구현하지 않는다**로 확정 — Google Places API(Place ID Refresh는 서버 API)·Overture Maps GERS(Jaro-Winkler 매칭이 배치 ETL)를 조사한 결과, 이런 "동일 개체 판정"은 일반적으로 백엔드가 안정적 ID/신호 필드로 내려주는 영역이지 클라이언트가 매 요청마다 재추정하는 영역이 아니다. 근본 수정(jibunAddress "산" 접두어 반영) 또는 명시적 신호 필드(`isMountainLot` 등) 추가를 백엔드에 제안했고, 당시 `server/spec/CHANGELOG.md`에 교차 기록해뒀던 것 — 백엔드 세션이 정식 검토해 `turbom-spec/CHANGELOG.md` 15차("PNU 권위 파일 조인 정정")로 반영·해결함(2026-07-18). 반대로 같은 조사에서 **테넌시 그룹핑(간트차트, `tenancy-grouping.ts`)은 계속 프론트에 둬도 된다고 확인**했다 — 서버가 이미 내려준 한 유닛의 타임라인을 그 화면 안에서만 시각적으로 묶는 순수 프레젠테이션 로직이라 이 원칙에 저촉되지 않는다.

**최종 해결(2026-07-22)**: 15차 이후에도 158만 행 규모로 데이터가 커지면서 권위 파일 조인이 재적용되지 않아 산여부 자기모순이 9만여 건 기준 1,630쌍 → 158만 건 기준 8,121쌍으로 다시 늘어난 게 발견됐다(turbom-spec CHANGELOG "PNU 산여부 자체정합성 감사" 조사 기록). 이번엔 권위 파일 조인이 아니라 각 행 자신의 `jibun_address`를 현재 파서로 재파싱해 자기모순을 잡는 방식으로 전수 감사(83,346건 불일치, 그중 83,244건이 "텍스트에 '산' 없는데 산여부=1로 저장" 방향으로 완전히 일방향) → 사용자 확인 후 해당 83,244건의 `pnu` 11번째 자리를 `1`→`0`으로 교정(CHANGELOG 23차). **실측 재검증**: 이 문서에 있던 원 사례(운중동 1034, `pnu 4113511500010340000`/`4113511500110340000`)가 교정 후 단일 사이트(`4113511500010340000`, 지하1층 유닛 포함 unitCount 3)로 병합된 것을 `/api/sites/search?query=운중동 1034`로 직접 확인함. 남은 3,214개 필지 페어(정상적인 산/비산 별개 필지와 잔여 버그가 섞여있을 가능성)는 이번 교정 범위 밖 — 재발 시 같은 방식(자기모순 감사)으로 재조사.

같은 조사 과정에서 함께 요청됐던 `buildingId`(동일 건물 판별용 안정 키, 위 "units[]엔 category/subCategory 없음" 항목 참고)는 "이 데이터 중복 문제부터 원인 치료하는 게 먼저"라는 이유로 보류됐다 — 데이터가 정리된 지금 시점에 다시 요청해볼 만하다.

### 지하/B 층 표기를 파서가 인식 못 함 + 파싱 신뢰도 HIGH로 일치하는데도 유닛이 안 합쳐지는 케이스

2026-07-18 실측(위든타워, `pnu 4113111600106900000`, 성남시 수정구 금토동 690) — 둘 다 백엔드 버그, 프론트에서 고칠 수 없어 당시 `server/spec/CHANGELOG.md`에 교차 기록(미커밋 상태로 방치돼 있던 걸 2026-07-19 스펙 통합 세션이 발견해 `turbom-spec/CHANGELOG.md`로 정식 이관 — 아직 백엔드 세션 검토 전). unitId 그대로 남겨 재현 가능.

- **버그 A(파서 누락)**: `4113111600106900000-U1`(`jibunAddress: "690 지1층 B113호"`)과 `-U2`(`"690 지1층 B114호"`) 둘 다 `parsedFloor`/`parsedUnitNo`가 `null`, `parseConfidence: "LOW"`, `label: "단일 점포"`로 떨어진다. 물건 분리 자체(B113/B114가 서로 다른 유닛으로 나뉘는 것)는 정확한데, "지1층"/"B113호" 같은 지하 표기를 `AddressDetailParser`가 못 알아봐서 **라벨 표시만** 두 물건이 똑같이 "단일 점포"로 보인다 — 실제로 다른 물건인데 목록에서 구분이 안 됨.
- **버그 B(물건 병합 누락)**: `-U3`(`jibunAddress: "690"`, `parsedFloor:"1"`/`parsedUnitNo:"102"`/`parseConfidence:"HIGH"`, 담배소매업 "지에스25 위든타워점")와 `-U5`(`jibunAddress: "690 1층 102(일부)호"`, 파싱 결과 U3와 완전 동일, 식품자동판매기업 "지에스(GS)25 위든타워점")는 같은 GS25 편의점이 겸업 인허가 2개를 낸 것(원본 주소 텍스트만 다르고 파싱 결과는 HIGH 신뢰도로 일치)인데도 서로 다른 유닛으로 남아 리포트 페이지 자체가 갈린다. 위 "산 지번" 항목에서 결론 낸 것과 같은 부류 문제(이미 신뢰도 높은 판정 결과가 있는데 병합에 안 씀) — `tenancy-grouping.ts`(한 유닛의 timeline 안에서만 동작)는 애초에 이 케이스를 볼 수 있는 범위 밖이라 프론트 대응 불가.

### (해결됨, 2026-07-19) 스펙 미러가 낡은 버전에 멈춰 있던 문제 — `turbom-spec` 통합 후 재동기화 완료

2026-07-18 당시엔 백엔드 로컬 `spec/api-spec.md`와 이 레포 미러(`docs/spec/api-spec.md`)가 서로 다른 부분만 반영된 채 갈라져 있었다(아래 상세는 §CHANGELOG 참고용으로 남김). 2026-07-19 스펙 통합(§1)으로 두 사본의 원인이었던 "루트 미git 사본 + 서버 레포 사본 + 프론트 레포 사본" 3원화 구조 자체가 없어졌지만, **통합 직후 실제로 diff해보니 이 레포 미러는 여전히 2026-07-16 시점 구버전(v3, marketInfo 최초 설계)에 멈춰 있었다** — `api-spec.md` 295줄 중 사실상 전부, `frontend-spec.md`는 503줄 diff. `noStorefrontRegistrations`/`parsedFloor`·`parsedUnitNo`·`parseConfidence`/`categoryBreakdown`/데이터 범위 확장 등 11~17차 변경분이 전혀 반영 안 된 상태였다.

**조치**: `docs/spec/{api-spec,frontend-spec}.md`를 `turbom-spec` 최신본으로 바이트 단위 동기화 완료. 동기화 전 `.github/workflows/spec-drift-check.yml`을 수동 실행(`gh workflow run`)해 자동 감지가 실제로 이 갭을 잡아내는지 먼저 검증했다 — `spec-drift` 라벨의 이슈 #1이 정상적으로 열리며 정확한 diff가 담긴 것 확인. 재타겟 커밋(`4ca97cd`) 직후엔 cron이 새 소스 기준으로 아직 한 번도 안 돌아서(다음 스케줄까지 갭) 자동으로는 안 잡혔던 것 — 향후 비슷하게 워크플로우 소스를 바꾸면, 다음 cron을 기다리지 말고 `gh workflow run`으로 즉시 검증할 것.

**남은 참고사항(2026-07-18 원기록)**: 백엔드 로컬 `spec/api-spec.md`엔 `noStorefrontRegistrations[]`(11차)·units 0개 자리 제외(12차)는 있었지만 `currentSubCategory`/`parsedFloor` 등 10차 이하 항목이 빠져 있었고, 이 레포 미러는 그 반대였다 — 실 배포 API 확인 결과 두 필드 세트 다 라이브였다(스펙 문서 쪽 관리 문제였지 실제 API 문제가 아니었음). `noStorefrontRegistrations`는 그때 실측 확인 후 `SiteDetail` 타입(`src/lib/api/types.ts`)에 이미 반영해뒀지만 — 아직 어느 화면에도 노출하는 UI는 안 만듦(필요하면 요청).
