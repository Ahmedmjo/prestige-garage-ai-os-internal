'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Settings, AlertTriangle, Save, RefreshCw, Shield, Package,
  TrendingDown, Calendar, Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n-context'

interface Thresholds {
  roll_low_threshold: number
  roll_critical_threshold: number
  roll_finished_threshold: number
  stock_low_multiplier: number
  stock_out_threshold: number
  consumption_waste_alert: number
  daily_attendance_alert: number
  monthly_advance_limit: number
}

const DEFAULT_THRESHOLDS: Thresholds = {
  roll_low_threshold: 5,
  roll_critical_threshold: 2,
  roll_finished_threshold: 0,
  stock_low_multiplier: 1.0,
  stock_out_threshold: 0,
  consumption_waste_alert: 1,
  daily_attendance_alert: 5,
  monthly_advance_limit: 3000,
}

const THRESHOLD_INFO: Record<keyof Thresholds, { label: string; description: string; color: string; icon: any; unit: string }> = {
  roll_low_threshold: {
    label: 'حد التنبيه الأصفر للرولات',
    description: 'الرولات اللي متبقيها أقل من هذا الرقم تتحول للأصفر (أوشك على النفاذ)',
    color: '#FF9100',
    icon: AlertTriangle,
    unit: 'متر',
  },
  roll_critical_threshold: {
    label: 'حد التنبيه البرتقالي للرولات',
    description: 'الرولات اللي متبقيها أقل من هذا الرقم تتحول للبرتقالي (حرج)',
    color: '#FF4500',
    icon: AlertTriangle,
    unit: 'متر',
  },
  roll_finished_threshold: {
    label: 'حد الرول المنتهي',
    description: 'الرولات اللي متبقيها أقل من أو يساوي هذا الرقم تتحول للأحمر (منتهي)',
    color: '#DC143C',
    icon: TrendingDown,
    unit: 'متر',
  },
  stock_low_multiplier: {
    label: 'مضاعف الحد الأدنى للمخزون',
    description: 'يُضرب في الحد الأدنى لكل صنف — إذا وصلت الكمية الحالية لهذه النسبة من الحد الأدنى يُعتبر منخفض',
    color: '#FF9100',
    icon: Package,
    unit: 'x',
  },
  stock_out_threshold: {
    label: 'حد نفاد المخزون',
    description: 'الكمية اللي إذا وصل لها الصنف يُعتبر نفد',
    color: '#DC143C',
    icon: Package,
    unit: 'وحدة',
  },
  consumption_waste_alert: {
    label: 'تنبيه الهالك في الاستهلاك',
    description: 'إذا زاد الهالك عن هذا الرقم في عملية استهلاك واحدة، يتم إصدار تنبيه',
    color: '#FF9100',
    icon: TrendingDown,
    unit: 'متر',
  },
  daily_attendance_alert: {
    label: 'تنبيه الغياب المتتالي',
    description: 'عدد أيام الغياب المتتالية اللي تستدعي تنبيه',
    color: '#DC143C',
    icon: Calendar,
    unit: 'يوم',
  },
  monthly_advance_limit: {
    label: 'حد السلف الشهرية للموظف',
    description: 'إذا تجاوزت السلف الشهرية لهذا الرقم، يتم إصدار تنبيه',
    color: '#FF9100',
    icon: Wallet,
    unit: 'ج.م',
  },
}

export function SettingsModule() {
  const { t, lang } = useI18n()
  const [thresholds, setThresholds] = useState<Thresholds>(DEFAULT_THRESHOLDS)
  const [original, setOriginal] = useState<Thresholds>(DEFAULT_THRESHOLDS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [source, setSource] = useState<'defaults' | 'database'>('defaults')

  useEffect(() => {
    loadThresholds()
  }, [])

  async function loadThresholds() {
    setLoading(true)
    try {
      const res = await fetch('/api/settings/alerts')
      const data = await res.json()
      if (data.thresholds) {
        const t: Thresholds = {
          roll_low_threshold: Number(data.thresholds.roll_low_threshold) || DEFAULT_THRESHOLDS.roll_low_threshold,
          roll_critical_threshold: Number(data.thresholds.roll_critical_threshold) || DEFAULT_THRESHOLDS.roll_critical_threshold,
          roll_finished_threshold: Number(data.thresholds.roll_finished_threshold) || DEFAULT_THRESHOLDS.roll_finished_threshold,
          stock_low_multiplier: Number(data.thresholds.stock_low_multiplier) || DEFAULT_THRESHOLDS.stock_low_multiplier,
          stock_out_threshold: Number(data.thresholds.stock_out_threshold) || DEFAULT_THRESHOLDS.stock_out_threshold,
          consumption_waste_alert: Number(data.thresholds.consumption_waste_alert) || DEFAULT_THRESHOLDS.consumption_waste_alert,
          daily_attendance_alert: Number(data.thresholds.daily_attendance_alert) || DEFAULT_THRESHOLDS.daily_attendance_alert,
          monthly_advance_limit: Number(data.thresholds.monthly_advance_limit) || DEFAULT_THRESHOLDS.monthly_advance_limit,
        }
        setThresholds(t)
        setOriginal(t)
        setSource(data.source || 'defaults')
      }
    } catch (e) {
      toast.error('فشل تحميل الإعدادات')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/alerts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thresholds }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'فشل الحفظ')
      }
      toast.success('تم حفظ إعدادات التنبيهات بنجاح')
      setOriginal(thresholds)
      setSource('database')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  function handleReset() {
    setThresholds(DEFAULT_THRESHOLDS)
    toast.info('تم استعادة الإعدادات الافتراضية (لن تُحفظ إلا عند الضغط على حفظ)')
  }

  function handleResetToOriginal() {
    setThresholds(original)
  }

  const hasChanges = JSON.stringify(thresholds) !== JSON.stringify(original)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 rounded-full border-4 border-[#DC143C]/20 border-t-[#DC143C] animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
            <Settings className="text-[#DC143C]" />
            إعدادات التنبيهات الذكية
          </h1>
          <p className="text-gray-400 mt-1">
            تحديد الحدود اللي تتحول عندها العناصر لألوان تنبيه — مستخرجة من ملف الإكسيل وقابلة للتعديل
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={loadThresholds}
            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
          >
            <RefreshCw size={16} className="ml-1" />
            تحديث
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="prestige-gradient border-0 hover:opacity-90"
          >
            <Save size={16} className="ml-1" />
            {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </Button>
        </div>
      </div>

      {/* Status banner */}
      <div className={`rounded-lg p-4 flex items-center gap-3 border ${
        source === 'database'
          ? 'bg-[#00C853]/8 border-[#00C853]/20'
          : 'bg-[#FF9100]/8 border-[#FF9100]/20'
      }`}>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
          source === 'database' ? 'bg-[#00C853]/20' : 'bg-[#FF9100]/20'
        }`}>
          <Shield size={18} className={source === 'database' ? 'text-[#00C853]' : 'text-[#FF9100]'} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-white">
            {source === 'database' ? '✅ الإعدادات محفوظة في قاعدة البيانات' : '⚠️ يتم استخدام الإعدادات الافتراضية'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {source === 'database'
              ? 'القيم الحالية محفوظة وستُستخدم في كل أنحاء النظام'
              : 'القيم الافتراضية مستخرجة من ملف الإكسيل — احفظ التغييرات لتخزينها في قاعدة البيانات'}
          </p>
        </div>
        {hasChanges && (
          <Badge className="bg-[#FF9100]/15 text-[#FF9100] border-[#FF9100]/30 text-xs">
            تغييرات غير محفوظة
          </Badge>
        )}
      </div>

      {/* Threshold cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(Object.keys(thresholds) as Array<keyof Thresholds>).map((key, idx) => {
          const info = THRESHOLD_INFO[key]
          const Icon = info.icon
          const value = thresholds[key]
          const isChanged = value !== original[key]

          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              className="prestige-card p-5"
              style={isChanged ? { borderColor: info.color + '60', boxShadow: `0 0 12px ${info.color}20` } : {}}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ background: info.color + '20' }}
                  >
                    <Icon size={18} style={{ color: info.color }} />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">{info.label}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{info.description}</p>
                  </div>
                </div>
                {isChanged && (
                  <Badge
                    className="text-[10px] px-1.5 py-0"
                    style={{ background: info.color + '20', color: info.color, border: 'none' }}
                  >
                    معدّل
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2 mt-3">
                <Input
                  type="number"
                  step="0.1"
                  value={value}
                  onChange={e => setThresholds({ ...thresholds, [key]: parseFloat(e.target.value) || 0 })}
                  className="bg-[#000] border-white/10 text-white text-lg font-bold"
                  style={{ borderColor: isChanged ? info.color + '60' : undefined }}
                />
                <span className="text-sm text-gray-400 min-w-[60px]">{info.unit}</span>
              </div>

              {/* Visual preview */}
              <div className="mt-3 pt-3 border-t border-white/5">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-500 ml-2">معاينة:</span>
                  {key === 'roll_low_threshold' || key === 'roll_critical_threshold' || key === 'roll_finished_threshold' ? (
                    <>
                      <div className="flex-1 h-2 rounded-full bg-[#00C853]/40" />
                      <div className="flex-1 h-2 rounded-full" style={{ background: '#FF9100' }} title="أصفر" />
                      <div className="flex-1 h-2 rounded-full" style={{ background: '#FF4500' }} title="برتقالي" />
                      <div className="flex-1 h-2 rounded-full" style={{ background: '#DC143C' }} title="أحمر" />
                    </>
                  ) : (
                    <div className="flex-1 h-2 rounded-full" style={{ background: `linear-gradient(90deg, #00C853, ${info.color})` }} />
                  )}
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Reset buttons */}
      <div className="flex flex-wrap gap-3 justify-end">
        <Button
          variant="ghost"
          onClick={handleResetToOriginal}
          disabled={!hasChanges}
          className="text-gray-400 hover:text-white"
        >
          التراجع عن التغييرات
        </Button>
        <Button
          variant="outline"
          onClick={handleReset}
          className="border-[#FF9100]/30 bg-[#FF9100]/5 text-[#FF9100] hover:bg-[#FF9100]/10"
        >
          استعادة الافتراضي
        </Button>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="prestige-gradient border-0 hover:opacity-90"
        >
          <Save size={16} className="ml-1" />
          {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
        </Button>
      </div>

      {/* Info section */}
      <div className="prestige-card p-5">
        <h3 className="font-bold text-white mb-3 flex items-center gap-2">
          <AlertTriangle size={16} className="text-[#FF9100]" />
          كيف تعمل التنبيهات الذكية؟
        </h3>
        <div className="space-y-3 text-sm text-gray-300">
          <div className="flex items-start gap-2">
            <span className="text-[#00C853]">●</span>
            <p>
              <strong className="text-white">الرولات (PPF):</strong> يتم حساب الرصيد المتبقي لكل رولة تلقائياً من (الطول الإجمالي - إجمالي الاستهلاك). كل رولة تُعرض بلون حسب الرصيد: أخضر (نشط)، أصفر (أوشك على النفاذ)، برتقالي (حرج)، أحمر (منتهي).
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[#FF9100]">●</span>
            <p>
              <strong className="text-white">المخزون:</strong> كل صنف له حد أدنى (minLevel) من ملف الإكسيل. إذا وصلت الكمية الحالية للحد الأدنى (أو أقل) يتحول الصنف لأصفر. إذا وصل لصفر يتحول لأحمر.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[#DC143C]">●</span>
            <p>
              <strong className="text-white">الغياب المتتالي:</strong> إذا تجاوز عدد أيام غياب الموظف الحد المحدد، يتم إنشاء تنبيه تلقائي في قسم الإشعارات.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[#BB86FC]">●</span>
            <p>
              <strong className="text-white">السلف الشهرية:</strong> إذا تجاوزت سلفيات الموظف في الشهر الحد المحدد، يتم إنشاء تنبيه لتنبيه المدير قبل أن تتراكم.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[#03DAC6]">●</span>
            <p>
              <strong className="text-white">الهالك في الاستهلاك:</strong> عند تسجيل استهلاك برولة، إذا زاد الهالك (waste) عن الحد المحدد، يتم إصدار تنبيه لمراجعة السبب.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
