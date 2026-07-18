// 인허가 원본의 상호명은 같은 가게라도 표기가 제각각이다 — 법인격
// 표기(주식회사/㈜ 등), 괄호 안 별칭, 전각/반각 문자, 공백·구두점 유무가
// 다르면 문자열이 달라진다. 이 모듈은 그런 잡음을 걷어낸 "핵심 이름"만
// 비교해 실질적으로 같은 상호인지 판정한다. 실측 근거(2026-07-18):
// - 4113111600107130000-U3: "씨유(CU) 판교이노베이션랩점" vs
//   "씨유 판교이노베이션랩점" — 같은 편의점이 안전상비의약품 판매업/
//   휴게음식점 두 인허가를 동시에 낸 것뿐인데 괄호 안 "CU"까지 남으면
//   문자열이 안 같아진다.
// - 4113111600107170000-U1: "(주)놀유니버스 구내식당" vs "풀무원푸드앤컬처
//   놀유니버스 구내식당" — 시설 소유주 자체 등록과 위탁급식업체가 운영사명을
//   앞에 붙여 등록한 케이스. 공통 부분이 뒤 문자열의 접두어가 아니라
//   접미어라 접두어 매칭만으론 못 잡는다.

// 상호 앞뒤 어디에 붙어도 실제 상호를 가리는 잡음으로 보고 제거하는
// 법인격 전체 표기. 괄호 안 약칭(㈜, (주) 등)은 괄호째 제거되므로 별도
// 목록이 필요 없다 — 여기 목록은 괄호 없이 그대로 쓰인 경우만 다룬다.
const CORPORATE_ENTITY_WORDS = [
  "주식회사",
  "유한회사",
  "합자회사",
  "합명회사",
  "유한책임회사",
  "사단법인",
  "재단법인",
  "사회복지법인",
  "학교법인",
  "의료법인",
  "협동조합",
  "영농조합법인",
  "영어조합법인",
  "농업회사법인",
  "어업회사법인",
];

// 상호명을 비교 가능한 "핵심 이름"으로 정규화한다.
export function normalizeBusinessName(raw: string): string {
  let name = raw
    // 전각 문자를 반각으로 통일 — "(CU)"와 "（ＣＵ）" 같은 표기 차이,
    // 전각 공백 등을 한 번에 흡수한다.
    .normalize("NFKC")
    // 괄호와 그 안의 내용을 통째로 제거(별칭·법인격 약칭·대표자명 등).
    .replace(/[（(][^）)]*[）)]/g, "");
  for (const word of CORPORATE_ENTITY_WORDS) {
    name = name.split(word).join("");
  }
  return name.replace(/[\s·.\-㈜]/g, "").toLowerCase();
}

// 정규화한 두 이름이 정확히 같거나, 한쪽이 다른 쪽을 통째로 포함하면 같은
// 상호로 본다. 포함 방향을 접두어(지점명이 뒤에 붙는 경우, 예: "스타벅스"/
// "스타벅스강남점")로만 제한하지 않는다 — 운영사명이 앞에 붙는 경우(위
// 놀유니버스 사례)까지 포괄하기 위해 양방향 포함을 본다. 짧은 쪽 길이가
// minSharedLength 미만이면(흔한 2글자 낱말 우연 일치 등) 오탐 위험이 커
// 같은 상호로 보지 않는다.
export function namesLikelySame(a: string, b: string, minSharedLength = 3): boolean {
  const na = normalizeBusinessName(a);
  const nb = normalizeBusinessName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const [shorter, longer] = na.length <= nb.length ? [na, nb] : [nb, na];
  return shorter.length >= minSharedLength && longer.includes(shorter);
}
