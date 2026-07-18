# CLAUDE.md — 터봄(Turbohm) 클라이언트 레포 규칙

이 레포(`turbom-client`, 프론트엔드)가 지켜야 할 스펙 범위와 정합성 규칙을 못박는 문서.

## 1. 스펙 소스

이 레포는 `github.com/nn98/turbom-server`의 `spec/` 문서 중 다음 두 개만 규범으로 삼는다:

- `spec/api-spec.md` — 프론트-백 연동 계약(요청/응답 스키마)
- `spec/frontend-spec.md` — 프론트 단독 명세

그 외(`backend-spec.md`, `schema.sql`, 인허가/상가API 파이프라인 문서 등)는 서버 레포 소관이며 이 레포는 참조하지 않는다.

## 2. 로컬 미러

위 두 파일은 `docs/spec/api-spec.md`, `docs/spec/frontend-spec.md`로 로컬에 동기화되어 있다 — 원본 파일명 그대로, 내용은 원본과 바이트 단위로 동일하게 유지한다(로컬에서 직접 수정하지 않는다). 코드 주석에서 이 계약을 가리킬 땐 반드시 `docs/spec/api-spec.md` 경로를 쓴다.

## 3. 정합성 원칙

현재 정상 동작하는 코드가 기준선이다. 스펙과 코드가 어긋나면:

1. 실제 배포 백엔드(`https://turbom.duckdns.org`, `.env.local`의 `VITE_API_BASE_URL`)를 호출해 실제 응답을 확인한다.
2. 케이스별로 어느 쪽을 갱신할지 판단한다 — "무조건 코드를 스펙에 맞춘다"가 원칙이 아니다.
3. 미러 사본(`docs/spec/*.md`)은 원본 그대로 두고, 코드가 스펙보다 실측을 우선한 경우 아래 "알려진 스펙-실측 차이"에 기록한다.

## 4. 스펙 드리프트 자동 감지

`.github/workflows/spec-drift-check.yml`이 매일 1회(+수동 실행)로 `turbom-server`의 `spec/api-spec.md`, `spec/frontend-spec.md`를 로컬 미러와 비교한다. 다르면 `spec-drift` 라벨의 이슈를 새로 열거나(이미 열려있으면 코멘트로) 갱신한다. GitHub Actions만 쓰고 외부 유료/LLM API 호출은 없다.

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

`api-spec.md`는 `units[].industryDetail`/`timeline[].marketInfo.categoryBreakdown`/`totalStoreCount`/`sameCategoryNearbyCount`가 상가API 동단위·반경 매칭으로 채워진다고 명시하지만, 2026-07-16 실측(성남시 수정구 3개 동·영업 중인 유닛 6곳 — 금토동 1곳, 신흥동 1곳, 창곡동 4곳)에서 **6/6 전부** `enrichmentSource: "license_only"`, `industryDetail: null`, `marketInfo.categoryBreakdown: []`, `marketInfo.totalStoreCount: null`, `marketInfo.sameCategoryNearbyCount: null`이었다. 표본이 작지만 100% 일관된 실패라 부분 커버리지 문제가 아니라 상가API 보강 파이프라인 자체가 배포 환경에서 전혀 실행되지 않고 있는 것으로 보인다(루트 프로젝트 CLAUDE.md §9엔 "실호출은 Railway 배포 후 검증"이 아직 미완료로 남아있음 — 이 검증이 안 된 상태로 보임).

**영향**: `업종 구성`(district.composition) 카드는 백엔드 필드가 비어있을 때 정직하게 실패 표시하는 대신 고정 목업 배열(`FALLBACK_COMPOSITION`, `src/lib/api/unit-analysis.ts`)로 대체되므로, 서로 다른 물건을 봐도 항상 똑같아 보인다 — 프론트 버그 아님, 백엔드 보강 미동작의 결과. 백엔드(`turbom-server`)에서 상가API 클라이언트 호출 여부·인증키 유효성을 먼저 확인해야 한다.

### `units[]`(검색·건물상세 물건목록)엔 `category`/`subCategory`가 없음 — `industryDetail`뿐

`api-spec.md` 245번째 줄 근처에 명시된 "세 업종 필드 구분: `category`(대분류, 필수) → `subCategory`(소분류, 필수) → `industryDetail`(상가API 세부, 있으면 우선)" 3단 폴백은 `timeline[]`(물건 상세, `/api/units/{unitId}`)에만 적용된다. `units[]` 필드표(같은 문서 105번째 줄 근처)엔 `industryDetail`만 있고 `category`/`subCategory`는 스펙에도, 실제 `/api/sites/{pnu}` 응답에도 없다(2026-07-16 실측 확인).

**영향**: 검색 결과 리스트(`search.tsx`의 `UnitList`)는 물건 상세처럼 "industryDetail 없으면 subCategory로 폴백" 표시를 할 수 없다 — 폴백할 데이터 자체가 이 API 레이어에 안 내려온다. 위 상가API 보강 미동작과 겹쳐 지금은 리스트에 업종 라벨이 거의 항상 안 보인다. **근본 해결은 백엔드가 `units[]` 응답에 `category`(또는 `subCategory`)를 추가하는 것**(인허가 원본에서 바로 만들 수 있는 값이라 상가API 보강과 무관하게 항상 채울 수 있음) — 프론트에서 유닛별로 `/api/units/{unitId}`를 추가 호출해 우회하는 건 리스트 하나 그리려고 N번의 추가 API 콜이 나가 권장하지 않는다.

### 서로 다른 `pnu`가 동일한 `jibunAddress` 텍스트를 공유하는 경우가 있다 — 지도 마커가 "축소 시 2개, 확대 시 1개"로 보이는 원인

실측(2026-07-18, `경기도 성남시 수정구 금토동 534-8`): `pnu` `4113111600005340008`(일반 지번)과 `4113111600105340008`(11번째 자릿수만 다름 — PNU 구조상 산여부 플래그로 추정, 즉 "산 534-8")가 완전히 동일한 `jibunAddress: "경기도 성남시 수정구 금토동 534-8"`, 완전히 동일한 `latitude`/`longitude`로 응답된다. 백엔드가 jibunAddress 문자열을 만들 때 "산" 접두어(또는 다른 구분 표기)를 반영하지 않는 것으로 보인다 — 이 자체는 백엔드 데이터 이슈로 남겨둠(프론트에서 지어낼 수 있는 값이 아님).

**영향과 조치**: 좌표가 완전히 같아 지도가 축소 상태(클러스터)에서는 "2"로 뭉쳐 보이다가, 확대해 클러스터가 풀려도 두 마커가 정확히 같은 픽셀 위치에 겹쳐 "1개"처럼 보인다. 더 심각한 프론트 버그를 같이 발견해 수정함: `search.tsx`/`site-markers.ts`가 "선택된 자리"를 `jibunAddress` 문자열로 식별하고 있었는데, 위 경우 두 후보가 텍스트까지 동일해 `.find()`가 항상 첫 번째만 찾고 두 번째 후보는 탭을 눌러도 선택할 수 없었다(활성 마커 표시도 둘 다 동시에 active가 되거나 안 되거나 했음). `pnu`(항상 고유)를 식별자로 바꿔 수정 — URL 검색 파라미터도 `jibun`→`pnu`로 개명(`selectJibun`→`selectSite`). `MapMarker.jibunAddress` 필드는 더 이상 아무도 안 읽어서 함께 제거.

**후속 조사(2026-07-18)**: 이 케이스를 계기로 "검색결과에서 서로 다른 pnu가 같은 자리로 보이면 시각적으로 묶어줄 수 있는가"를 검토했다(`docs/superpowers/specs/2026-07-18-site-entity-similarity-design.md` 참고). 결론은 **프론트에서 지오+문자열 유사도 휴리스틱으로 구현하지 않는다**로 확정 — Google Places API(Place ID Refresh는 서버 API)·Overture Maps GERS(Jaro-Winkler 매칭이 배치 ETL)를 조사한 결과, 이런 "동일 개체 판정"은 일반적으로 백엔드가 안정적 ID/신호 필드로 내려주는 영역이지 클라이언트가 매 요청마다 재추정하는 영역이 아니다. 근본 수정(jibunAddress "산" 접두어 반영) 또는 명시적 신호 필드(`isMountainLot` 등) 추가를 백엔드에 제안했고, `server/spec/CHANGELOG.md`에 교차 기록해뒀다(미커밋, 백엔드 세션 검토 대기). 반대로 같은 조사에서 **테넌시 그룹핑(간트차트, `tenancy-grouping.ts`)은 계속 프론트에 둬도 된다고 확인**했다 — 서버가 이미 내려준 한 유닛의 타임라인을 그 화면 안에서만 시각적으로 묶는 순수 프레젠테이션 로직이라 이 원칙에 저촉되지 않는다.

### 지하/B 층 표기를 파서가 인식 못 함 + 파싱 신뢰도 HIGH로 일치하는데도 유닛이 안 합쳐지는 케이스

2026-07-18 실측(위든타워, `pnu 4113111600106900000`, 성남시 수정구 금토동 690) — 둘 다 백엔드 버그, 프론트에서 고칠 수 없어 `server/spec/CHANGELOG.md`에 교차 기록(미커밋, 백엔드 세션 검토 대기). unitId 그대로 남겨 재현 가능.

- **버그 A(파서 누락)**: `4113111600106900000-U1`(`jibunAddress: "690 지1층 B113호"`)과 `-U2`(`"690 지1층 B114호"`) 둘 다 `parsedFloor`/`parsedUnitNo`가 `null`, `parseConfidence: "LOW"`, `label: "단일 점포"`로 떨어진다. 물건 분리 자체(B113/B114가 서로 다른 유닛으로 나뉘는 것)는 정확한데, "지1층"/"B113호" 같은 지하 표기를 `AddressDetailParser`가 못 알아봐서 **라벨 표시만** 두 물건이 똑같이 "단일 점포"로 보인다 — 실제로 다른 물건인데 목록에서 구분이 안 됨.
- **버그 B(물건 병합 누락)**: `-U3`(`jibunAddress: "690"`, `parsedFloor:"1"`/`parsedUnitNo:"102"`/`parseConfidence:"HIGH"`, 담배소매업 "지에스25 위든타워점")와 `-U5`(`jibunAddress: "690 1층 102(일부)호"`, 파싱 결과 U3와 완전 동일, 식품자동판매기업 "지에스(GS)25 위든타워점")는 같은 GS25 편의점이 겸업 인허가 2개를 낸 것(원본 주소 텍스트만 다르고 파싱 결과는 HIGH 신뢰도로 일치)인데도 서로 다른 유닛으로 남아 리포트 페이지 자체가 갈린다. 위 "산 지번" 항목에서 결론 낸 것과 같은 부류 문제(이미 신뢰도 높은 판정 결과가 있는데 병합에 안 씀) — `tenancy-grouping.ts`(한 유닛의 timeline 안에서만 동작)는 애초에 이 케이스를 볼 수 있는 범위 밖이라 프론트 대응 불가.

### 백엔드 로컬 스펙(`D:\...\woowaTon\spec\api-spec.md`)과 이 레포 미러(`docs/spec/api-spec.md`)가 내용 기준으로 서로 다르게 갱신돼 있음

2026-07-18 확인: 백엔드 세션이 작업 중인 로컬 `spec/api-spec.md`엔 그날 새로 추가된 `noStorefrontRegistrations[]`(무점포/자가신고형 업종 분리, 11차)와 units 0개 자리 검색 제외(12차)는 반영돼 있지만, 그보다 먼저(2026-07-10~17) 추가됐어야 할 `currentSubCategory`/`parsedFloor`·`parsedUnitNo`·`parseConfidence`/`categoryBreakdown`·`totalStoreCount`/`survivalMonths` null 처리 관련 서술은 빠져 있다 — 반대로 이 레포의 `docs/spec/api-spec.md`는 그 반대 상태(오래된 항목은 있고 `noStorefrontRegistrations`는 없음). 실 배포 API로 직접 확인한 결과 **두 세트 다 실제로 라이브 상태**(`/api/sites/{pnu}` 응답에 양쪽 필드가 동시에 존재) — 로컬 `spec/` 파일 쪽이 어느 시점엔가 오래된 베이스에서 편집을 시작해 일부 구간을 유실한 것으로 보인다. 이 레포에서 고칠 대상은 아니고(그 파일은 서버 레포 소관), 백엔드 세션 쪽에 알려서 정리가 필요함. `noStorefrontRegistrations`는 실측 확인 후 `SiteDetail` 타입(`src/lib/api/types.ts`)에 반영해뒀지만 — 아직 어느 화면에도 노출하는 UI는 안 만듦(필요하면 요청).
