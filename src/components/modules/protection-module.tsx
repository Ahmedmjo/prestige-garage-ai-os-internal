'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Shield, Package, TrendingDown, AlertTriangle, CheckCircle2, XCircle,
  Search, Plus, History, Film, DollarSign, Activity,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n-context'
import { formatNumber, formatCurrency } from '@/lib/i18n'

interface Roll {
  id: string
  code: string
  brand: string
  type: string
  model: string | null
  width: number | null
  totalLength: number
  remainingLength: number | null
  price: number | null
  supplier: string | null
  purchaseDate: string | null
  notes: string | null
  status: string
  rollCategory?: string
  carsCount?: number
  consumptions?: any[]
}

interface OBGroup {
  workOrder: string
  clientName: string | null
  carType: string | null
  date: string
  totalMeters: number
  rollsCount: number
  rolls: Array<{
    rollCode: string
    metersUsed: number
    waste: number
    usageArea: string | null
  }>
}

const STATUS_CONFIG = {
  active: { label: 'نشط', color: '#00C853', bg: 'rgba(0,200,83,0.12)', icon: CheckCircle2 },
  low: { label: 'أوشك على النفاذ', color: '#FF9100', bg: 'rgba(255,145,0,0.12)', icon: AlertTriangle },
  finished: { label: 'منتهي', color: '#DC143C', bg: 'rgba(220,20,60,0.12)', icon: XCircle },
}

// Thresholds from Excel-based defaults (can be overridden via /api/settings/alerts)
const DEFAULT_THRESHOLDS = {
  roll_low: 5,       // أصفر
  roll_critical: 2,  // برتقالي
  roll_finished: 0,  // أحمر
}

export function ProtectionModule() {
  const { t, lang } = useI18n()
  const [rolls, setRolls] = useState<Roll[]>([])
  const [obGroups, setObGroups] = useState<OBGroup[]>([])
  const [nextOB, setNextOB] = useState('OB-0001')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showConsumptionDialog, setShowConsumptionDialog] = useState(false)
  const [selectedRoll, setSelectedRoll] = useState<Roll | null>(null)
  const [showOBList, setShowOBList] = useState(false)

  useEffect(() => {
    loadData()
    loadThresholds()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [rollsRes, obRes] = await Promise.all([
        fetch('/api/rolls'),
        fetch('/api/ai/protection-action'),
      ])
      const rollsData = await rollsRes.json()
      const obData = await obRes.json()
      setRolls(rollsData)
      setObGroups(obData.recentOBs || [])
      setNextOB(obData.nextOB || 'OB-0001')
    } catch (e) {
      toast.error('فشل تحميل البيانات')
    } finally {
      setLoading(false)
    }
  }

  async function loadThresholds() {
    try {
      const res = await fetch('/api/settings/alerts')
      const data = await res.json()
      if (data.thresholds) {
        setThresholds({
          roll_low: data.thresholds.roll_low_threshold || DEFAULT_THRESHOLDS.roll_low,
          roll_critical: data.thresholds.roll_critical_threshold || DEFAULT_THRESHOLDS.roll_critical,
          roll_finished: data.thresholds.roll_finished_threshold || DEFAULT_THRESHOLDS.roll_finished,
        })
      }
    } catch (e) {
      // use defaults
    }
  }

  // Get roll status based on remaining length and thresholds
  function getRollStatus(remaining: number): { status: string; label: string; color: string; bg: string; percent: number } {
    if (remaining <= thresholds.roll_finished) {
      return { status: 'finished', label: 'منتهي', color: '#DC143C', bg: 'rgba(220,20,60,0.12)', percent: 100 }
    }
    if (remaining <= thresholds.roll_critical) {
      return { status: 'critical', label: 'حرج', color: '#FF4500', bg: 'rgba(255,69,0,0.12)', percent: 85 }
    }
    if (remaining <= thresholds.roll_low) {
      return { status: 'low', label: 'أوشك على النفاذ', color: '#FF9100', bg: 'rgba(255,145,0,0.12)', percent: 60 }
    }
    return { status: 'active', label: 'نشط', color: '#00C853', bg: 'rgba(0,200,83,0.12)', percent: 30 }
  }

  // Calculate dashboard stats
  const stats = {
    total: rolls.length,
    active: rolls.filter(r => (r.remainingLength || 0) > thresholds.roll_low).length,
    low: rolls.filter(r => {
      const rem = r.remainingLength || 0
      return rem > thresholds.roll_critical && rem <= thresholds.roll_low
    }).length,
    critical: rolls.filter(r => {
      const rem = r.remainingLength || 0
      return rem > thresholds.roll_finished && rem <= thresholds.roll_critical
    }).length,
    finished: rolls.filter(r => (r.remainingLength || 0) <= thresholds.roll_finished).length,
    totalValue: rolls.reduce((s, r) => {
      const remaining = r.remainingLength || 0
      const total = r.totalLength || 1
      return s + ((r.price || 0) * (remaining / total))
    }, 0),
    totalConsumedValue: rolls.reduce((s, r) => {
      const remaining = r.remainingLength || 0
      const total = r.totalLength || 1
      const consumed = total - remaining
      return s + ((r.price || 0) * (consumed / total))
    }, 0),
    totalRemainingMeters: rolls.reduce((s, r) => s + (r.remainingLength || 0), 0),
    totalInventoryValue: rolls.reduce((s, r) => s + (r.price || 0), 0),
  }

  const filtered = rolls.filter(r => {
    const matchesSearch = !search ||
      r.code.toLowerCase().includes(search.toLowerCase()) ||
      r.brand.toLowerCase().includes(search.toLowerCase()) ||
      r.type.toLowerCase().includes(search.toLowerCase()) ||
      (r.supplier || '').toLowerCase().includes(search.toLowerCase())
    const rem = r.remainingLength || 0
    let matchesStatus = true
    if (statusFilter !== 'all') {
      const st = getRollStatus(rem).status
      matchesStatus = st === statusFilter
    }
    return matchesSearch && matchesStatus
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
            <Shield className="text-[#00C853]" />
            لوحة تحكم البروتيكشن
          </h1>
          <p className="text-gray-400 mt-1">نظام جرد البروتيكشن — مصفوفة الرولات بنفس نمط ملف الإكسيل</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={() => setShowOBList(true)}
            variant="outline"
            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
          >
            <History size={16} className="ml-1" />
            سجل أوامر الشغل
          </Button>
          <Button
            onClick={() => setShowAddDialog(true)}
            className="prestige-gradient border-0 hover:opacity-90"
          >
            <Plus size={16} className="ml-1" />
            رول جديد
          </Button>
          <Button
            onClick={() => setShowConsumptionDialog(true)}
            variant="outline"
            className="border-[#FF9100]/30 bg-[#FF9100]/10 text-[#FF9100] hover:bg-[#FF9100]/20"
          >
            <TrendingDown size={16} className="ml-1" />
            تسجيل استهلاك
          </Button>
        </div>
      </div>

      {/* Dashboard stats — same layout as Excel sheet */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="prestige-card p-4">
          <p className="text-xs text-gray-400">إجمالي الرولات</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="prestige-card p-4" style={{ background: 'rgba(0,200,83,0.05)' }}>
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 size={14} className="text-[#00C853]" />
            <p className="text-xs text-gray-400">رولات نشطة</p>
          </div>
          <p className="text-2xl font-bold text-[#00C853] mt-1">{stats.active}</p>
        </div>
        <div className="prestige-card p-4" style={{ background: 'rgba(255,145,0,0.05)' }}>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={14} className="text-[#FF9100]" />
            <p className="text-xs text-gray-400">أوشك على النفاذ</p>
          </div>
          <p className="text-2xl font-bold text-[#FF9100] mt-1">{stats.low + stats.critical}</p>
        </div>
        <div className="prestige-card p-4" style={{ background: 'rgba(220,20,60,0.05)' }}>
          <div className="flex items-center gap-2 mb-1">
            <XCircle size={14} className="text-[#DC143C]" />
            <p className="text-xs text-gray-400">رولات منتهية</p>
          </div>
          <p className="text-2xl font-bold text-[#DC143C] mt-1">{stats.finished}</p>
        </div>
      </div>

      {/* Financial stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="prestige-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={14} className="text-[#DC143C]" />
            <p className="text-xs text-gray-400">قيمة المخزون الكاملة</p>
          </div>
          <p className="text-lg font-bold text-white mt-1">{formatNumber(Math.round(stats.totalInventoryValue), lang)}</p>
          <p className="text-xs text-gray-500">{t('egp')}</p>
        </div>
        <div className="prestige-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={14} className="text-[#00C853]" />
            <p className="text-xs text-gray-400">قيمة المخزون المتبقي</p>
          </div>
          <p className="text-lg font-bold text-[#00C853] mt-1">{formatNumber(Math.round(stats.totalValue), lang)}</p>
          <p className="text-xs text-gray-500">{t('egp')}</p>
        </div>
        <div className="prestige-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Activity size={14} className="text-[#FF9100]" />
            <p className="text-xs text-gray-400">قيمة المواد المستهلكة</p>
          </div>
          <p className="text-lg font-bold text-[#FF9100] mt-1">{formatNumber(Math.round(stats.totalConsumedValue), lang)}</p>
          <p className="text-xs text-gray-500">{t('egp')}</p>
        </div>
        <div className="prestige-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Film size={14} className="text-[#03DAC6]" />
            <p className="text-xs text-gray-400">إجمالي الأمتار المتبقية</p>
          </div>
          <p className="text-lg font-bold text-[#03DAC6] mt-1">{stats.totalRemainingMeters.toFixed(1)} م</p>
        </div>
      </div>

      {/* Next OB banner */}
      <div className="bg-gradient-to-r from-[#00C853]/15 via-[#00C853]/5 to-transparent border border-[#00C853]/20 rounded-lg p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#00C853]/20 flex items-center justify-center">
            <Shield size={20} className="text-[#00C853]" />
          </div>
          <div>
            <p className="text-xs text-gray-400">أمر الشغل التالي</p>
            <p className="text-xl font-bold text-white font-mono">{nextOB}</p>
          </div>
        </div>
        <Button
          onClick={() => setShowConsumptionDialog(true)}
          className="bg-[#00C853] hover:bg-[#00C853]/80 text-white border-0"
        >
          <Plus size={16} className="ml-1" />
          تسجيل بـ {nextOB}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <Input
            placeholder="بحث بالكود أو الماركة أو النوع..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-[#0A0A0A] border-white/10 text-white pr-10 placeholder:text-gray-600"
          />
        </div>
        <div className="flex gap-1 bg-[#0A0A0A] border border-white/10 rounded-lg p-1 flex-wrap">
          {[
            { id: 'all', label: 'الكل', color: '#FFFFFF' },
            { id: 'active', label: 'نشط', color: '#00C853' },
            { id: 'low', label: 'منخفض', color: '#FF9100' },
            { id: 'critical', label: 'حرج', color: '#FF4500' },
            { id: 'finished', label: 'منتهي', color: '#DC143C' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`px-3 py-1.5 rounded-md text-sm transition-all ${
                statusFilter === f.id
                  ? 'bg-[#DC143C] text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
              style={statusFilter === f.id ? {} : { color: f.color }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* MATRIX GRID — same as Excel protection sheet layout */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">لا توجد رولات مطابقة</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filtered.map((roll, idx) => {
            const remaining = roll.remainingLength || 0
            const total = roll.totalLength || 1
            const st = getRollStatus(remaining)
            const usedPercent = ((total - remaining) / total) * 100
            const remainingPercent = 100 - usedPercent

            return (
              <motion.div
                key={roll.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.02 }}
                onClick={() => {
                  setSelectedRoll(roll)
                  setShowConsumptionDialog(true)
                }}
                className="prestige-card p-4 cursor-pointer group relative overflow-hidden"
                style={{ background: st.bg }}
              >
                {/* Status accent border */}
                <div
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ background: st.color }}
                />

                {/* Header — code + status */}
                <div className="flex items-start justify-between mb-2 mt-1">
                  <Package size={14} style={{ color: st.color }} />
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: st.color + '20', color: st.color }}
                  >
                    {st.label}
                  </span>
                </div>

                {/* Roll code */}
                <h3 className="font-bold text-white font-mono text-xs mb-1 truncate">{roll.code}</h3>
                <p className="text-[10px] text-gray-400 mb-2 truncate">{roll.brand} · {roll.type}</p>

                {/* Remaining length - big number */}
                <div className="text-center my-2">
                  <p className="text-2xl font-bold" style={{ color: st.color }}>
                    {remaining.toFixed(1)}
                  </p>
                  <p className="text-[10px] text-gray-500">من {total.toFixed(0)} متر</p>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${remainingPercent}%`,
                      background: st.color,
                      boxShadow: `0 0 6px ${st.color}80`,
                    }}
                  />
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-[10px] text-gray-500">
                  <span>{usedPercent.toFixed(0)}% مستهلك</span>
                  {roll.carsCount && roll.carsCount > 0 ? (
                    <span className="text-[#03DAC6]">🚗 {roll.carsCount}</span>
                  ) : null}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Recent OBs */}
      <div className="prestige-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-white flex items-center gap-2">
            <History size={16} className="text-[#FF9100]" />
            أحدث أوامر الشغل
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowOBList(true)}
            className="text-gray-400 hover:text-white text-xs"
          >
            عرض الكل
          </Button>
        </div>
        {obGroups.length === 0 ? (
          <p className="text-center py-6 text-gray-500 text-sm">لا توجد أوامر شغل بعد</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {obGroups.slice(0, 6).map(ob => (
              <div
                key={ob.workOrder}
                className="rounded-lg p-3 bg-white/3 border border-white/5"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono font-bold text-[#03DAC6] text-sm">{ob.workOrder}</span>
                  <span className="text-[10px] text-gray-500">{new Date(ob.date).toLocaleDateString('en-GB')}</span>
                </div>
                <p className="text-xs text-white mb-1">{ob.clientName || 'عميل غير محدد'}</p>
                <p className="text-[10px] text-gray-500 mb-2">{ob.carType || ''}</p>
                <div className="flex items-center justify-between text-[10px]">
                  <Badge className="bg-[#FF9100]/15 text-[#FF9100] border-[#FF9100]/30 text-[10px] px-1.5 py-0">
                    {ob.totalMeters.toFixed(1)} م
                  </Badge>
                  <span className="text-gray-500">{ob.rollsCount} رولات</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <AddRollDialog open={showAddDialog} onOpenChange={setShowAddDialog} onSuccess={loadData} />
      <ConsumptionDialog
        open={showConsumptionDialog}
        onOpenChange={setShowConsumptionDialog}
        rolls={rolls}
        preselectedRoll={selectedRoll}
        defaultOB={nextOB}
        onSuccess={loadData}
      />
      <OBListDialog
        open={showOBList}
        onOpenChange={setShowOBList}
        obGroups={obGroups}
      />
    </div>
  )
}

// ─── Add Roll Dialog (compact) ─────────────────────────
function AddRollDialog({ open, onOpenChange, onSuccess }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSuccess: () => void
}) {
  const { t, lang } = useI18n()
  const [form, setForm] = useState({
    code: '', brand: '', type: '', model: '', width: '', totalLength: '',
    price: '', supplier: '', purchaseDate: '', notes: '',
    rollCategory: 'ppf',
  })
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    if (!form.brand || !form.type || !form.totalLength) {
      toast.error('الماركة والنوع والطول مطلوبة')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/rolls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'فشل الإضافة')
      }
      const result = await res.json()
      toast.success(`تم إضافة الرول ${result.code}`)
      setForm({ code: '', brand: '', type: '', model: '', width: '', totalLength: '', price: '', supplier: '', purchaseDate: '', notes: '', rollCategory: 'ppf' })
      onOpenChange(false)
      onSuccess()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const suggestedCode = form.brand && form.type
    ? `${form.brand.slice(0, 3).toUpperCase()}-${form.type.slice(0, 3).toUpperCase()}-${String(Math.floor(Math.random() * 900) + 100)}`
    : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0A0A0A] border-white/10 text-white max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-white">إضافة رول جديد</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div>
            <Label className="text-gray-400 text-xs">كود الرول (اختياري)</Label>
            <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder={suggestedCode || 'HXS-BF-001'} className="bg-[#000] border-white/10 text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">الفئة</Label>
            <select value={form.rollCategory} onChange={e => setForm({ ...form, rollCategory: e.target.value })} className="w-full bg-[#000] border border-white/10 rounded-md px-3 py-2 text-white mt-1">
              <option value="ppf">بروتيكشن PPF</option>
              <option value="thermal_long">عزل طويل</option>
              <option value="thermal_short">عزل قصير</option>
            </select>
          </div>
          <div>
            <Label className="text-gray-400 text-xs">الماركة *</Label>
            <Input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} placeholder="Hexis" className="bg-[#000] border-white/10 text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">النوع *</Label>
            <Input value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} placeholder="Body Fence" className="bg-[#000] border-white/10 text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">الموديل</Label>
            <Input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} placeholder="Glossy" className="bg-[#000] border-white/10 text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">العرض (م)</Label>
            <Input type="number" value={form.width} onChange={e => setForm({ ...form, width: e.target.value })} placeholder="1.52" className="bg-[#000] border-white/10 text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">الطول الإجمالي (م) *</Label>
            <Input type="number" value={form.totalLength} onChange={e => setForm({ ...form, totalLength: e.target.value })} placeholder="15" className="bg-[#000] border-white/10 text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">السعر ({t('egp')})</Label>
            <Input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="18500" className="bg-[#000] border-white/10 text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">المورد</Label>
            <Input value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} placeholder="Al-Banna" className="bg-[#000] border-white/10 text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">تاريخ الشراء</Label>
            <Input type="date" value={form.purchaseDate} onChange={e => setForm({ ...form, purchaseDate: e.target.value })} className="bg-[#000] border-white/10 text-white mt-1" />
          </div>
          <div className="col-span-2">
            <Label className="text-gray-400 text-xs">ملاحظات</Label>
            <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="bg-[#000] border-white/10 text-white mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-gray-400">إلغاء</Button>
          <Button onClick={handleSubmit} disabled={saving} className="prestige-gradient border-0">
            {saving ? 'جاري الحفظ...' : 'إضافة الرول'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Consumption Dialog ──────────────────────────────
function ConsumptionDialog({ open, onOpenChange, rolls, preselectedRoll, defaultOB, onSuccess }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  rolls: Roll[]
  preselectedRoll: Roll | null
  defaultOB: string
  onSuccess: () => void
}) {
  const { t, lang } = useI18n()
  const [form, setForm] = useState({
    rollCode: '', date: new Date().toISOString().split('T')[0],
    clientName: '', carType: '', plateNumber: '',
    metersUsed: '', waste: '', usageArea: '', workOrder: '', notes: '', technician: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (preselectedRoll) {
      setForm(f => ({ ...f, rollCode: preselectedRoll.code, workOrder: defaultOB }))
    } else {
      setForm(f => ({ ...f, workOrder: defaultOB }))
    }
  }, [preselectedRoll, defaultOB])

  async function handleSubmit() {
    if (!form.rollCode || !form.metersUsed) {
      toast.error('كود الرول والأمتار المستهلكة مطلوبة')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/consumptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'فشل التسجيل')
      }
      const result = await res.json()
      toast.success(`تم تسجيل استهلاك ${form.metersUsed}م من ${form.rollCode} بأمر الشغل ${form.workOrder}. المتبقي: ${result.newRemaining.toFixed(2)}م`)
      setForm({
        rollCode: '', date: new Date().toISOString().split('T')[0],
        clientName: '', carType: '', plateNumber: '',
        metersUsed: '', waste: '', usageArea: '', workOrder: defaultOB, notes: '', technician: '',
      })
      onOpenChange(false)
      onSuccess()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const activeRolls = rolls.filter(r => (r.remainingLength || 0) > 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0A0A0A] border-white/10 text-white max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-white">تسجيل استهلاك رول</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="col-span-2">
            <Label className="text-gray-400 text-xs">الرول *</Label>
            <select value={form.rollCode} onChange={e => setForm({ ...form, rollCode: e.target.value })} className="w-full bg-[#000] border border-white/10 rounded-md px-3 py-2 text-white mt-1">
              <option value="">— اختر الرول —</option>
              {activeRolls.map(r => (
                <option key={r.id} value={r.code}>
                  {r.code} · {r.brand} {r.type} (متبقي {r.remainingLength?.toFixed(1)}م)
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-gray-400 text-xs">التاريخ</Label>
            <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="bg-[#000] border-white/10 text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">رقم أمر الشغل (OB)</Label>
            <Input value={form.workOrder} onChange={e => setForm({ ...form, workOrder: e.target.value })} placeholder="OB-0001" className="bg-[#000] border-[#00C853]/30 text-white mt-1 font-mono" />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">اسم العميل</Label>
            <Input value={form.clientName} onChange={e => setForm({ ...form, clientName: e.target.value })} className="bg-[#000] border-white/10 text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">نوع السيارة</Label>
            <Input value={form.carType} onChange={e => setForm({ ...form, carType: e.target.value })} className="bg-[#000] border-white/10 text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">الأمتار المستهلكة (م) *</Label>
            <Input type="number" value={form.metersUsed} onChange={e => setForm({ ...form, metersUsed: e.target.value })} className="bg-[#000] border-white/10 text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">الهالك (م)</Label>
            <Input type="number" value={form.waste} onChange={e => setForm({ ...form, waste: e.target.value })} className="bg-[#000] border-white/10 text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">جهة الاستخدام</Label>
            <Input value={form.usageArea} onChange={e => setForm({ ...form, usageArea: e.target.value })} placeholder="Full Body / Front Fender" className="bg-[#000] border-white/10 text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">الفني</Label>
            <Input value={form.technician} onChange={e => setForm({ ...form, technician: e.target.value })} className="bg-[#000] border-white/10 text-white mt-1" />
          </div>
          <div className="col-span-2">
            <Label className="text-gray-400 text-xs">ملاحظات</Label>
            <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="bg-[#000] border-white/10 text-white mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-gray-400">إلغاء</Button>
          <Button onClick={handleSubmit} disabled={saving} className="prestige-gradient border-0">
            {saving ? 'جاري الحفظ...' : 'تسجيل الاستهلاك'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── OB List Dialog ────────────────────────────────────
function OBListDialog({ open, onOpenChange, obGroups }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  obGroups: OBGroup[]
}) {
  const { t, lang } = useI18n()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0A0A0A] border-white/10 text-white max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <History size={18} className="text-[#FF9100]" />
            سجل أوامر الشغل ({obGroups.length})
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto flex-1">
          {obGroups.length === 0 ? (
            <div className="text-center py-8 text-gray-500">لا توجد أوامر شغل</div>
          ) : (
            <div className="space-y-3">
              {obGroups.map(ob => (
                <div key={ob.workOrder} className="rounded-lg p-4 bg-white/3 border border-white/5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[#03DAC6]">{ob.workOrder}</span>
                      <span className="text-[10px] text-gray-500">{new Date(ob.date).toLocaleDateString('en-GB')}</span>
                    </div>
                    <Badge className="bg-[#FF9100]/15 text-[#FF9100] border-[#FF9100]/30 text-xs">
                      {ob.totalMeters.toFixed(1)} متر
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-500">العميل</p>
                      <p className="text-white">{ob.clientName || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">السيارة</p>
                      <p className="text-white">{ob.carType || '-'}</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-white/5">
                    <p className="text-xs text-gray-500 mb-2">الرولات المستهلكة ({ob.rollsCount}):</p>
                    <div className="space-y-1">
                      {ob.rolls.map((r, i) => (
                        <div key={i} className="flex items-center justify-between text-xs bg-white/3 rounded p-2">
                          <span className="font-mono text-[#FF9100]">{r.rollCode}</span>
                          <span className="text-white">{r.metersUsed}م</span>
                          {r.waste > 0 && <span className="text-[#DC143C]">هالك: {r.waste}م</span>}
                          {r.usageArea && <span className="text-gray-400">{r.usageArea}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
