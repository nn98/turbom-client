import type { RiskLevel } from "@/lib/api";

// 별점 대신 색 하나 + 텍스트로만 위험도를 표시 — report/landing 양쪽에서
// 같은 시각 언어를 쓰도록 공용 컴포넌트로 분리(리포트 페이지에서 처음 정착시킨 패턴).
const RISK_BADGE_CLASS: Record<"danger" | "warn" | "brand", string> = {
  danger: "bg-danger-soft text-danger",
  warn: "bg-warn-soft text-warn",
  brand: "bg-brand-soft text-brand",
};

export function riskToneOf(level: RiskLevel): "danger" | "warn" | "brand" {
  if (level >= 4) return "danger";
  if (level === 3) return "warn";
  return "brand";
}

export function RiskBadge({ level, label }: { level: RiskLevel; label: string }) {
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold " +
        RISK_BADGE_CLASS[riskToneOf(level)]
      }
    >
      <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      {label}
    </span>
  );
}
