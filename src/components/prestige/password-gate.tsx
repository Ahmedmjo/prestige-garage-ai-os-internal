'use client'

import { useState, useEffect } from 'react'
import { Lock, ArrowLeft } from 'lucide-react'
import { PrestigeLogo } from '@/components/prestige/logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const STORAGE_KEY = 'prestige-garage-access'
const ACCESS_PASSWORD = '0203'

/**
 * Password Gate — يظهر قبل التطبيق الرئيسي.
 * المستخدم يدخل كلمة السر "0203" → تتخزن في localStorage → التطبيق يفتح.
 * مبسّط للاستخدام الداخلي (مش أمان عالي — للحماية من الوصول العابر).
 */
export function PasswordGate({ children }: { children: React.ReactNode }) {
  const [granted, setGranted] = useState(false)
  const [checking, setChecking] = useState(true)
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
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
    <div className="min-h-screen bg-black flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="mb-4">
            <PrestigeLogo size={96} />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wider">PRESTIGE GARAGE</h1>
          <p className="text-xs text-gray-500 mt-1 tracking-widest">نظام الإدارة الداخلي</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <Input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(false) }}
              placeholder="كلمة المرور"
              className="bg-[#0A0A0A] border-white/10 text-white text-center text-lg tracking-widest pr-10 h-12"
              autoFocus
              dir="ltr"
            />
          </div>

          {error && (
            <p className="text-[#DC143C] text-sm text-center">كلمة المرور غير صحيحة</p>
          )}

          <Button
            type="submit"
            className="w-full prestige-gradient border-0 h-12 text-base"
          >
            <ArrowLeft size={18} className="ml-2" />
            دخول
          </Button>
        </form>

        <p className="text-center text-[10px] text-gray-600 mt-8">
          Prestige Garage AI-OS © 2026
        </p>
      </div>
    </div>
  )
}
