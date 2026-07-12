// 랜딩 전용 커스텀 SVG — 실사진/스톡 이미지 대신 브랜드 컬러(currentColor
// 상속)로 그린 추상 그래픽. 전부 순수 장식이라 aria-hidden.

export function SkylineGraphic({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 160" fill="none" className={className} aria-hidden="true">
      <rect x="10" y="70" width="40" height="90" rx="2" fill="currentColor" />
      <rect x="60" y="40" width="40" height="120" rx="2" fill="currentColor" />
      <rect x="110" y="90" width="40" height="70" rx="2" fill="currentColor" />
      <rect x="160" y="20" width="40" height="140" rx="2" fill="currentColor" />
      <rect x="210" y="60" width="40" height="100" rx="2" fill="currentColor" />
      <rect x="260" y="0" width="40" height="160" rx="2" fill="currentColor" />
      <rect x="310" y="50" width="40" height="110" rx="2" fill="currentColor" />
      <rect x="360" y="85" width="30" height="75" rx="2" fill="currentColor" />
    </svg>
  );
}

export function PinPulseGraphic({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className={className} aria-hidden="true">
      <circle cx="60" cy="60" r="46" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" />
      <circle cx="60" cy="60" r="30" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.5" />
      <path
        d="M60 30c-12 0-22 9.5-22 21 0 15.8 22 39 22 39s22-23.2 22-39c0-11.5-10-21-22-21z"
        fill="currentColor"
      />
      <circle cx="60" cy="51" r="8" fill="var(--color-surface)" />
    </svg>
  );
}

export function LayersGraphic({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 140" fill="none" className={className} aria-hidden="true">
      <rect
        x="20"
        y="70"
        width="160"
        height="50"
        rx="10"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeOpacity="0.3"
      />
      <rect
        x="35"
        y="40"
        width="160"
        height="50"
        rx="10"
        fill="currentColor"
        fillOpacity="0.18"
        stroke="currentColor"
        strokeOpacity="0.45"
      />
      <rect x="10" y="10" width="160" height="50" rx="10" fill="currentColor" />
    </svg>
  );
}

export function ChecklistGraphic({ className }: { className?: string }) {
  const rows = [35, 62, 89];
  return (
    <svg viewBox="0 0 120 140" fill="none" className={className} aria-hidden="true">
      <rect
        x="10"
        y="5"
        width="100"
        height="130"
        rx="12"
        stroke="currentColor"
        strokeWidth="2"
        strokeOpacity="0.25"
      />
      <rect x="40" y="0" width="40" height="14" rx="6" fill="currentColor" />
      {rows.map((y) => (
        <g key={y}>
          <rect x="24" y={y} width="16" height="16" rx="4" stroke="currentColor" strokeWidth="2" />
          <path
            d={`M27 ${y + 8} l4 4 l7 -8`}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <rect
            x="52"
            y={y + 3}
            width="48"
            height="10"
            rx="5"
            fill="currentColor"
            fillOpacity="0.3"
          />
        </g>
      ))}
    </svg>
  );
}
