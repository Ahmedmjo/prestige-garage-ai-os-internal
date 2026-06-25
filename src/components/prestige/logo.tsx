'use client'

interface LogoProps {
  size?: number
  className?: string
}

/**
 * Prestige Garage Logo — hexagonal premium badge with stylized P + accent
 */
export function PrestigeLogo({ size = 48, className = '' }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="pgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#DC143C" />
          <stop offset="100%" stopColor="#8B0A1F" />
        </linearGradient>
        <linearGradient id="pgChrome" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="50%" stopColor="#E0E0E0" />
          <stop offset="100%" stopColor="#888888" />
        </linearGradient>
      </defs>

      {/* Outer hexagon */}
      <polygon
        points="60,4 110,32 110,88 60,116 10,88 10,32"
        fill="url(#pgGrad)"
        stroke="#DC143C"
        strokeWidth="2"
      />
      {/* Inner hexagon */}
      <polygon
        points="60,12 102,36 102,84 60,108 18,84 18,36"
        fill="#0A0A0A"
        stroke="url(#pgChrome)"
        strokeWidth="1"
      />
      {/* Stylized P */}
      <g transform="translate(60 60)">
        <rect x="-10" y="-22" width="8" height="44" rx="2" fill="url(#pgChrome)" />
        <path
          d="M -2 -22 Q 18 -22 18 -8 Q 18 4 -2 4 L -2 -4 Q 10 -4 10 -8 Q 10 -14 -2 -14 Z"
          fill="url(#pgChrome)"
        />
        <polygon points="0,18 -4,22 0,26 4,22" fill="#DC143C" />
      </g>
      {/* Bottom text bar */}
      <rect x="22" y="78" width="76" height="14" rx="2" fill="#DC143C" />
      <text
        x="60"
        y="88"
        textAnchor="middle"
        fontFamily="-apple-system, Segoe UI, sans-serif"
        fontSize="7"
        fontWeight="bold"
        fill="#FFFFFF"
        letterSpacing="2"
      >
        PRESTIGE
      </text>
    </svg>
  )
}
