'use client'

import { useState, useEffect } from 'react'
import { Lock, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const STORAGE_KEY = 'prestige-garage-access'
const ACCESS_PASSWORD = '0203'

/**
 * Password Gate — يظهر قبل التطبيق الرئيسي.
 * خلفية بصورة العلامة التجارية + خانة كلمة المرور.
 */
export function PasswordGate({ children }: { children: React.ReactNode }) {
  const [granted, setGranted] = useState(false)
  const [checking, setChecking] = useState(true)
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
    // Check localStorage immediately — no waiting for images
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === ACCESS_PASSWORD) {
        setGranted(true)
      }
    } catch {}
    setChecking(false)
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password === ACCESS_PASSWORD) {
      try { localStorage.setItem(STORAGE_KEY, ACCESS_PASSWORD) } catch {}
      setGranted(true)
      setError(false)
    } else {
      setError(true)
      setPassword('')
    }
  }

  // Loading state — simple spinner, NO background image (don't wait for image load)
  if (checking) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#DC143C]/30 border-t-[#DC143C] rounded-full animate-spin" />
      </div>
    )
  }

  if (granted) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden" dir="rtl">
      {/* Splash image as full background — non-blocking */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: 'url(/prestige-splash.jpg)' }}
      />
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="text-center">
            <h1 className="text-3xl font-extrabold text-white tracking-wider drop-shadow-[0_2px_8px_rgba(220,20,60,0.5)]">
              PRESTIGE GARAGE
            </h1>
            <p className="text-xs text-gray-300 mt-2 tracking-widest">نظام الإدارة الداخلي</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <Input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(false) }}
              placeholder="كلمة المرور"
              className="bg-black/60 border-white/20 text-white text-center text-lg tracking-widest pr-10 h-12 backdrop-blur-sm placeholder:text-gray-400"
              autoFocus
              dir="ltr"
            />
          </div>

          {error && (
            <p className="text-[#FF4444] text-sm text-center font-medium">كلمة المرور غير صحيحة</p>
          )}

          <Button
            type="submit"
            className="w-full prestige-gradient border-0 h-12 text-base font-semibold"
          >
            <ArrowLeft size={18} className="ml-2" />
            دخول
          </Button>
        </form>

        <p className="text-center text-[10px] text-gray-500 mt-8">
          Prestige Garage AI-OS © 2026
        </p>
      </div>
    </div>
  )
}
