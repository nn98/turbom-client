# 동일 업소/동일 자리 판정 — 범위 조사 및 설계

## 배경

`report.$storeId.tsx`의 간트차트가 이미 "기간이 겹치고 상호명이 사실상 같은" 테넌시를 시각적으로 묶는 기능(`src/lib/tenancy-grouping.ts` + `src/lib/business-name.ts`)을 갖고 있다. 이 기능을 확장하면서, 일반적인 지도/검색 서비스가 "동일 업소/동일 장소"를 어떻게 식별·비교하는지, 거기 쓰이는 라이브러리·기법에 이 프로젝트가 적용할 지점이 있는지 조사해달라는 요청으로 시작했다.

조사 중 사용자가 스코프를 "유닛 단위를 넘어선 전역 식별 유틸"로 넓혔고, 구체적 두 번째 소비처로 **검색결과/마커 단위 "같은 자리로 보임" 힌트**(금토동 534-8 같은, 서로 다른 `pnu`가 같은 `jibunAddress` 텍스트+좌표로 응답되는 케이스)를 지목했다. 설계를 진행하는 도중, "이게 프론트 vs 백엔드 중 어느 쪽 책임이 적절한지, 일반적으로 어디서 처리하는지 먼저 확인하라"는 요청이 추가로 들어와 그 조사 결과가 이 스펙의 핵심 결론을 바꿨다.

## 조사 결과

**업계 사례 1 — Overture Maps GERS**(Amazon/Microsoft/Meta/TomTom 공동 후원, 2024년 오픈 지오스페이셜 표준): 공식 튜토리얼에 실제 매칭 SQL이 공개돼 있다.

```sql
JOIN places p
  ON ST_DWithin(f.geom, p.geom, 0.001)          -- 공간 근접성으로 후보 압축(blocking)
  AND jaro_winkler_similarity(name) > 0.89       -- 상호명 유사도 점수
  AND jaro_winkler_similarity(address) > 0.75    -- 주소 유사도 점수
ORDER BY name_similarity DESC                    -- 최고 점수 후보만 채택(랭킹)
```

핵심은 이게 **릴리스마다 한 번씩 도는 배치 ETL**이라는 점이다 — 매 요청마다 도는 클라이언트 계산이 아니다.

**업계 사례 2 — Google Places API**: 공식 문서가 "동일한 장소가 여러 Place ID를 가질 수 있고, 시간이 지나며 바뀔 수도 있다"고 명시하면서, 해결책으로 **서버 API**(`place/details/json?place_id=...`, "Place ID Refresh")를 제공한다. 클라이언트가 이름/주소/좌표로 직접 유사도를 계산해 "이거 같은 장소 아니야?"를 판정하게 하지 않는다.

**일반 엔티티 리졸루션(레코드 연결) 도구**: `dedupe`(ML 기반 active learning)와 `splink`(확률적 Fellegi-Sunter 모델) 둘 다 성숙한 라이브러리지만 **Python 전용**이고 배치 처리 전제라 이 프론트 레포에 직접 못 쓴다. JS 쪽 등가물(Jaro-Winkler/Levenshtein/Dice 계수 구현체: `natural`, `talisman`, `string-similarity` 등)은 이 프로젝트에 설치돼 있지 않고(package.json 확인), context7 색인 커버리지도 얕아 실제 채택 전 npm에서 직접 재확인이 필요하다.

## 결론 — 프론트 vs 백엔드 역할 분담

세 사례 모두 같은 패턴이다: **동일 개체 판정은 백엔드/데이터 파이프라인이 처리해서 안정적인 ID(또는 명시적 신호 필드)로 클라이언트에 내려준다. 클라이언트는 그 결과를 소비할 뿐, 매 요청마다 재추정하지 않는다.**

이 원칙을 우리 두 소비처에 각각 대입하면 성격이 다르다:

| 소비처 | 판단 | 근거 |
|---|---|---|
| 테넌시 그룹핑(간트차트, 기존 구현) | **프론트 유지 타당** | 서버가 이미 내려준 한 유닛의 작은 타임라인을 그 화면 안에서만 시각적으로 묶는 것 — 어떤 ID나 영속 데이터에도 영향 없는 순수 프레젠테이션 로직. 데이터 자체의 정합성 문제가 아니라 "같은 화면 안에서 어떻게 보여줄까"의 문제. |
| 검색결과/마커 "같은 자리" 힌트(신규 제안) | **백엔드 위임이 타당** | `pnu`라는 이미 안정적인 백엔드 ID가 있는데, 그 ID들이 실제로 같은 자리를 가리키는지를 프론트가 매 검색마다 지오+문자열 유사도로 재추정하는 구조. 근본 원인(jibunAddress가 "산" 표기를 반영 안 함)을 프론트가 약하게 우회하는 것에 가깝고, 일반적인 업계 패턴과도 어긋난다. |

## 채택 접근

- **테넌시 그룹핑**: 변경 없음. `business-name.ts`(부분문자열 포함 판정)와 신규 검토했던 Jaro-Winkler 점수 방식을 알고리즘 레벨에서 통일하지 않는다(사용자 확정 — 기존 로직은 실측 2건으로 이미 검증됐고, 회귀 위험 없이 그대로 둔다).
- **검색결과/마커 힌트**: 이번 스코프에서 **프론트 구현하지 않는다**. 대신:
  1. 백엔드 레포(`D:\Dev\_Woowahan-Techcourse\woowaTon\server`)의 `spec/CHANGELOG.md`에 이 조사 결과와 구체적 제안(아래 참고)을 교차 기록했다(커밋은 하지 않음 — 그 레포는 별도 세션이 활발히 작업 중이라 파일 변경만 남기고 커밋 여부는 백엔드 세션 판단에 맡김).
  2. 이 스펙 문서를 근거 기록으로 남긴다.

### 백엔드에 제안한 옵션 (server/spec/CHANGELOG.md에 동일하게 기록됨)

1. **근본 수정**: `jibunAddress` 생성 로직이 산 지번일 때 "산" 접두어를 반영 — 텍스트 자체가 달라지면 충돌이 사라짐.
2. **명시적 신호 필드**: `GET /api/sites/search`의 `candidates[]`에 `isMountainLot: boolean`(또는 동등한 필드) 추가 — 프론트가 텍스트/좌표 유사도로 추측하지 않고 이 필드로 바로 구분.

## 보류된 아키텍처 (참고용 — 백엔드가 "프론트에서 처리해달라"고 명시적으로 요청하면 이 설계를 꺼내 쓴다)

혹시 이후에 프론트 구현이 실제로 필요해지면 아래 설계를 그대로 적용한다:

- `src/lib/string-similarity.ts`(신규) — Jaro-Winkler 점수 알고리즘, 의존성 없는 순수 함수. 도메인 무관.
- `src/lib/site-similarity.ts`(신규) — `haversineDistanceMeters` + 위 Jaro-Winkler로 `groupSimilarSites(candidates)` 제공. `tenancy-grouping.ts`와 동일하게 `Map<pnu, groupId>` 반환.
- 판정 기준: 블로킹 `haversineDistanceMeters <= 30m`, 확정 `jaroWinklerSimilarity(jibunAddress) >= 0.85`(Overture는 주소 0.75~0.8을 쓰지만 우리 지번 주소는 짧고 정형이라 더 보수적으로).
- 적용 범위: `search.tsx`의 SegmentedTabs·"지금 보고 있는 자리" 패널에 간트차트와 같은 배경 강조만(동작 변경 없음). **지도 마커(map-view.tsx)는 제외** — 네이버맵 SDK가 localhost에서 불안정하다고 이전 세션에서 확인된 영역이라 검증 어려운 리스크를 늘리지 않기 위함.
- 좌표 null/주소 빈 문자열 → 그룹 없음으로 안전 처리(테넌시 그룹핑과 동일 패턴).
- 테스트: 금토동 534-8 실측 케이스(좌표 동일·주소 동일·pnu만 다름) 재현 + 좌표 멀리 떨어진 미유사 주소 음성 케이스.

## 하지 않는 것 (명시적 스코프 제외)

- `string-similarity.ts`/`site-similarity.ts` 실제 구현 — 백엔드 결정 대기.
- `business-name.ts`의 알고리즘을 Jaro-Winkler로 교체 — 사용자 확정, 하지 않음.
- `map-view.tsx` 마커 스타일 변경 — 애초 스코프에서 제외.
- `server/spec/api-spec.md`/`schema.sql` 등 백엔드 캐노니컬 스펙 파일 직접 수정 — CHANGELOG.md에 제안만 기록, 실제 반영은 백엔드 세션 판단.

## 교차 기록 위치

- `D:\Dev\_Woowahan-Techcourse\woowaTon\server\spec\CHANGELOG.md` — "2026-07-18 (프론트 세션 발견사항 — 번호 미부여)" 항목(미커밋, 백엔드 세션 검토 대기).
- 이 문서(`docs/superpowers/specs/2026-07-18-site-entity-similarity-design.md`).

## 검증 계획

이번 스코프는 코드 변경이 없어 실행 가능한 테스트 대상이 없다. 확인할 것:

- `server/spec/CHANGELOG.md`에 위 항목이 실제로 존재하는지(`git status`로 미커밋 diff 확인 가능).
- 향후 백엔드가 `isMountainLot` 필드나 jibunAddress 수정을 반영하면, 프론트는 **추가 대응 불필요**(현재 `pnu` 기준 식별 방식이 이미 정답이라 그대로 둠) — 이 사실을 재확인만 하면 된다.
