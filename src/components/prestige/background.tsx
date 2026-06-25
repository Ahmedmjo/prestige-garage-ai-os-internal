'use client'

/**
 * Subtle luxury car background — dark watermark style
 * Uses CSS-only design with SVG patterns to avoid external image dependencies.
 * Provides a dark, non-distracting backdrop that suits the garage aesthetic.
 */
export function BackgroundDecoration() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10" aria-hidden="true">
      {/* Gradient base — deep black with subtle red tint at corners */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at top right, rgba(220, 20, 60, 0.04) 0%, transparent 50%), radial-gradient(ellipse at bottom left, rgba(220, 20, 60, 0.03) 0%, transparent 50%), #000000',
        }}
      />

      {/* Subtle carbon-fiber pattern */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `
            repeating-linear-gradient(45deg, transparent 0, transparent 2px, rgba(255,255,255,0.4) 2px, rgba(255,255,255,0.4) 4px),
            repeating-linear-gradient(-45deg, transparent 0, transparent 2px, rgba(255,255,255,0.3) 2px, rgba(255,255,255,0.3) 4px)
          `,
          backgroundSize: '12px 12px',
        }}
      />

      {/* Watermark silhouettes — luxury sports car shapes */}
      <svg
        className="absolute top-1/4 -right-32 w-[600px] h-[300px] opacity-[0.04]"
        viewBox="0 0 600 300"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Sports car silhouette */}
        <path
          d="M 50 200 Q 80 180 120 175 L 180 140 Q 220 120 280 115 L 380 115 Q 440 120 480 145 L 530 175 Q 560 180 580 200 L 580 220 Q 560 230 530 230 L 100 230 Q 60 230 50 220 Z"
          fill="url(#carGrad1)"
        />
        {/* Wheels */}
        <circle cx="150" cy="230" r="32" fill="#000" stroke="#DC143C" strokeWidth="2" opacity="0.5" />
        <circle cx="150" cy="230" r="18" fill="#0A0A0A" stroke="#888" strokeWidth="1" />
        <circle cx="450" cy="230" r="32" fill="#000" stroke="#DC143C" strokeWidth="2" opacity="0.5" />
        <circle cx="450" cy="230" r="18" fill="#0A0A0A" stroke="#888" strokeWidth="1" />
        <defs>
          <linearGradient id="carGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#DC143C" />
            <stop offset="100%" stopColor="#000" />
          </linearGradient>
        </defs>
      </svg>

      {/* Second car silhouette — bottom left, smaller */}
      <svg
        className="absolute bottom-1/4 -left-40 w-[500px] h-[250px] opacity-[0.035] rotate-12"
        viewBox="0 0 500 250"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M 40 170 Q 70 150 100 145 L 150 115 Q 190 95 250 92 L 340 92 Q 390 95 420 120 L 460 145 Q 480 150 490 170 L 490 195 Q 470 200 440 200 L 80 200 Q 50 200 40 195 Z"
          fill="#DC143C"
        />
        <circle cx="130" cy="200" r="28" fill="#000" stroke="#DC143C" strokeWidth="1.5" opacity="0.4" />
        <circle cx="380" cy="200" r="28" fill="#000" stroke="#DC143C" strokeWidth="1.5" opacity="0.4" />
      </svg>

      {/* Top right gear icon — watermark */}
      <svg
        className="absolute top-10 right-10 w-32 h-32 opacity-[0.04]"
        viewBox="0 0 100 100"
        fill="none"
      >
        <path
          d="M50 20 L55 30 L65 28 L62 38 L72 42 L65 50 L72 58 L62 62 L65 72 L55 70 L50 80 L45 70 L35 72 L38 62 L28 58 L35 50 L28 42 L38 38 L35 28 L45 30 Z"
          fill="#DC143C"
        />
        <circle cx="50" cy="50" r="10" fill="#000" />
      </svg>

      {/* Subtle grid lines for tech feel */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />
    </div>
  )
}
