'use client'

import Image from 'next/image'

interface LogoProps {
  size?: number
  className?: string
}

/**
 * Prestige Garage Logo — uses the official registered trademark brand logo.
 */
export function PrestigeLogo({ size = 48, className = '' }: LogoProps) {
  return (
    <div
      className={`relative flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src="/prestige-brand-logo.png"
        alt="Prestige Garage"
        fill
        className="object-contain"
        priority
        sizes={`${size}px`}
      />
    </div>
  )
}
