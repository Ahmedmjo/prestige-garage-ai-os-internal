'use client'

import { useState, useEffect } from 'react'
import { Download, X, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * PWA Install Button - بسيط ومباشر
 * - يظهر فقط إذا كان التطبيق قابل للتثبيت
 * - زر واحد يفتح شاشة التثبيت الأصلية للمتصفح
 * - يتختفي بعد التثبيت أو الرفض
 */
export function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [showHint, setShowHint] = useState(false)

  useEffect(() => {
    // تحقق إذا كان التطبيق مثبت بالفعل
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
      setIsInstalled(true)
      return
    }

    const handler = (e: Event) => {
      // منع المتصفح من عرض شاشة التثبيت التلقائية
      e.preventDefault()
      // احتفظ بالـ event لاستخدامه عند الضغط على الزر
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    const installedHandler = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
      setShowHint(false)
    }

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', installedHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  // لو التطبيق مثبت بالفعل أو غير قابل للتثبيت، لا تعرض شيء
  if (isInstalled || !deferredPrompt) {
    return null
  }

  async function handleInstall() {
    if (!deferredPrompt) return
    // اعرض شاشة التثبيت الأصلية
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    if (choice.outcome === 'accepted') {
      setIsInstalled(true)
      setDeferredPrompt(null)
    } else {
      // لو المستخدم رفض، اعرض تلميح لكيفية التثبيت اليدوي
      setShowHint(true)
    }
    setDeferredPrompt(null)
  }

  return (
    <>
      <Button
        onClick={handleInstall}
        size="sm"
        className="bg-[#00C853] hover:bg-[#00C853]/80 text-white border-0 gap-1.5"
        title="تثبيت التطبيق على الجهاز"
      >
        <Download size={14} />
        <span className="hidden sm:inline">تثبيت التطبيق</span>
        <span className="sm:hidden">تثبيت</span>
      </Button>

      {/* تلميح التثبيت اليدوي للمتصفحات اللي لا تدعم beforeinstallprompt (iOS Safari) */}
      {showHint && (
        <div
          className="fixed bottom-4 right-4 left-4 md:right-auto md:max-w-md z-50 bg-[#0A0A0A] border border-[#00C853]/30 rounded-lg p-4 shadow-2xl"
          dir="rtl"
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <Smartphone size={18} className="text-[#00C853]" />
              <h4 className="font-bold text-white text-sm">كيفية التثبيت</h4>
            </div>
            <button
              onClick={() => setShowHint(false)}
              className="text-gray-400 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
          <div className="text-xs text-gray-300 space-y-1.5">
            <p>
              <strong className="text-white">على iOS (Safari):</strong>
              <br />
              اضغط زر المشاركة <span className="inline-block px-1.5 py-0.5 bg-white/10 rounded text-[10px]">⬆️</span>
              ثم "إلى الشاشة الرئيسية" <span className="inline-block px-1.5 py-0.5 bg-white/10 rounded text-[10px]">➕</span>
            </p>
            <p className="pt-1.5 border-t border-white/5 mt-1.5">
              <strong className="text-white">على Android (Chrome):</strong>
              <br />
              من القائمة <span className="inline-block px-1.5 py-0.5 bg-white/10 rounded text-[10px]">⋮</span>
              اختر "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية"
            </p>
          </div>
        </div>
      )}
    </>
  )
}
