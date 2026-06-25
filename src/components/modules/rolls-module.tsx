'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Film, Plus, Search, Package, TrendingDown, AlertTriangle,
  CheckCircle2, XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
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
  consumptions?: any[]
}

// Status labels are localized inline below

const STATUS_CONFIG = (lang: 'ar' | 'en'): Record<string, { label: string; color: string; bg: string; icon: any }> => ({
  active: { label: lang === 'ar' ? 'نشط' : 'Active', color: '#00C853', bg: 'rgba(0,200,83,0.12)', icon: CheckCircle2 },
  low: { label: lang === 'ar' ? 'أوشك على النفاذ' : 'Running Low', color: '#FF9100', bg: 'rgba(255,145,0,0.12)', icon: AlertTriangle },
  finished: { label: lang === 'ar' ? 'منتهي' : 'Finished', color: '#DC143C', bg: 'rgba(220,20,60,0.12)', icon: XCircle },
})

export function RollsModule() {
  const { t, lang } = useI18n()
  const [rolls, setRolls] = useState<Roll[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showConsumptionDialog, setShowConsumptionDialog] = useState(false)
  const [selectedRoll, setSelectedRoll] = useState<Roll | null>(null)
  const statusConfig = STATUS_CONFIG(lang)

  useEffect(() => {
    loadRolls()
  }, [])

  async function loadRolls() {
    setLoading(true)
    try {
      const res = await fetch('/api/rolls')
      const data = await res.json()
      setRolls(data)
    } catch (e) {
      toast.error('فشل تحميل الرولات')
    } finally {
      setLoading(false)
    }
  }

  const stats = {
    total: rolls.length,
    active: rolls.filter(r => r.status === 'active').length,
    low: rolls.filter(r => r.status === 'low').length,
    finished: rolls.filter(r => r.status === 'finished').length,
    ppf: rolls.filter(r => r.rollCategory === 'ppf').length,
    thermalLong: rolls.filter(r => r.rollCategory === 'thermal_long').length,
    thermalShort: rolls.filter(r => r.rollCategory === 'thermal_short').length,
    totalValue: rolls.reduce((s, r) => {
      const remaining = r.remainingLength || 0
      const total = r.totalLength || 1
      return s + ((r.price || 0) * (remaining / total))
    }, 0),
  }

  // Category filter
  const [categoryFilter, setCategoryFilter] = useState('all')

  const filtered = rolls.filter(r => {
    const matchesSearch = !search ||
      r.code.toLowerCase().includes(search.toLowerCase()) ||
      r.brand.toLowerCase().includes(search.toLowerCase()) ||
      r.type.toLowerCase().includes(search.toLowerCase()) ||
      (r.supplier || '').toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter
    const matchesCategory = categoryFilter === 'all' || r.rollCategory === categoryFilter
    return matchesSearch && matchesStatus && matchesCategory
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
            <Film className="text-[#FF9100]" />
            جرد الرولات (PPF)
          </h1>
          <p className="text-gray-400 mt-1">إدارة رولات البروتيكشن والاستهلاك التلقائي</p>
        </div>
        <div className="flex gap-2">
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
            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
          >
            <TrendingDown size={16} className="ml-1" />
            تسجيل استهلاك
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="prestige-card p-4">
          <p className="text-xs text-gray-400">{lang === 'ar' ? 'إجمالي الرولات' : 'Total Rolls'}</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="prestige-card p-4">
          <p className="text-xs text-gray-400">{lang === 'ar' ? 'بروتيكشن PPF' : 'PPF Protection'}</p>
          <p className="text-2xl font-bold text-[#00C853] mt-1">{stats.ppf}</p>
        </div>
        <div className="prestige-card p-4">
          <p className="text-xs text-gray-400">{lang === 'ar' ? 'عزل طويل' : 'Thermal Long'}</p>
          <p className="text-2xl font-bold text-[#03DAC6] mt-1">{stats.thermalLong}</p>
        </div>
        <div className="prestige-card p-4">
          <p className="text-xs text-gray-400">{lang === 'ar' ? 'عزل قصير' : 'Thermal Short'}</p>
          <p className="text-2xl font-bold text-[#FF9100] mt-1">{stats.thermalShort}</p>
        </div>
        <div className="prestige-card p-4">
          <p className="text-xs text-gray-400">{lang === 'ar' ? 'قيمة المخزون' : 'Inventory Value'}</p>
          <p className="text-xl font-bold text-white mt-1">{formatNumber(Math.round(stats.totalValue), lang)}</p>
          <p className="text-xs text-gray-500">{t('egp')}</p>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex gap-1 bg-[#0A0A0A] border border-white/10 rounded-lg p-1 flex-wrap">
          {[
            { id: 'all', label: lang === 'ar' ? 'الكل' : 'All' },
            { id: 'ppf', label: lang === 'ar' ? 'بروتيكشن' : 'PPF' },
            { id: 'thermal_long', label: lang === 'ar' ? 'عزل طويل' : 'Thermal Long' },
            { id: 'thermal_short', label: lang === 'ar' ? 'عزل قصير' : 'Thermal Short' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setCategoryFilter(f.id)}
              className={`px-3 py-1.5 rounded-md text-sm transition-all ${
                categoryFilter === f.id ? 'bg-[#DC143C] text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
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
        <div className="flex gap-1 bg-[#0A0A0A] border border-white/10 rounded-lg p-1">
          {[
            { id: 'all', label: 'الكل' },
            { id: 'active', label: 'نشط' },
            { id: 'low', label: 'منخفض' },
            { id: 'finished', label: 'منتهي' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`px-3 py-1.5 rounded-md text-sm transition-all ${
                statusFilter === f.id
                  ? 'bg-[#DC143C] text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Rolls grid */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">لا توجد رولات مطابقة</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((roll, idx) => {
            const status = statusConfig[roll.status] || statusConfig.active
            const StatusIcon = status.icon
            const remaining = roll.remainingLength || 0
            const total = roll.totalLength || 1
            const usedPercent = ((total - remaining) / total) * 100

            return (
              <motion.div
                key={roll.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                onClick={() => setSelectedRoll(roll)}
                className="prestige-card p-5 cursor-pointer group"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Package size={16} className="text-[#FF9100]" />
                      <h3 className="font-bold text-white font-mono">{roll.code}</h3>
                      <Badge
                        className="text-[10px] px-1.5 py-0"
                        style={{
                          background: roll.rollCategory === 'ppf' ? 'rgba(0,200,83,0.15)' :
                                      roll.rollCategory === 'thermal_long' ? 'rgba(3,218,198,0.15)' :
                                      'rgba(255,145,0,0.15)',
                          color: roll.rollCategory === 'ppf' ? '#00C853' :
                                 roll.rollCategory === 'thermal_long' ? '#03DAC6' : '#FF9100',
                          border: 'none',
                        }}
                      >
                        {roll.rollCategory === 'ppf' ? (lang === 'ar' ? 'بروتيكشن' : 'PPF') :
                         roll.rollCategory === 'thermal_long' ? (lang === 'ar' ? 'عزل طويل' : 'Thermal L') :
                         (lang === 'ar' ? 'عزل قصير' : 'Thermal S')}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-400">{roll.brand} · {roll.type}</p>
                  </div>
                  <Badge
                    style={{ background: status.bg, color: status.color, borderColor: status.color + '40' }}
                    className="border flex items-center gap-1 text-xs"
                  >
                    <StatusIcon size={12} />
                    {status.label}
                  </Badge>
                </div>

                {/* Model & supplier */}
                {roll.model && (
                  <p className="text-xs text-gray-500 mb-2">{lang === 'ar' ? 'الموديل' : 'Model'}: {roll.model}</p>
                )}

                {/* Supplier — new prominent field */}
                {roll.supplier && (
                  <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                    <span className="text-gray-500">{lang === 'ar' ? 'المورد' : 'Supplier'}:</span>
                    <span className="font-medium text-gray-300">{roll.supplier}</span>
                  </p>
                )}

                {/* Length progress */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-400">{lang === 'ar' ? 'المتبقي' : 'Remaining'}</span>
                    <span className="font-bold text-white">
                      {remaining.toFixed(2)} / {total.toFixed(0)} {lang === 'ar' ? 'متر' : 'm'}
                    </span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${100 - usedPercent}%` }}
                      transition={{ duration: 0.6, delay: idx * 0.03 }}
                      className="h-full rounded-full"
                      style={{
                        background: status.color,
                        boxShadow: `0 0 8px ${status.color}80`,
                      }}
                    />
                  </div>
                </div>

                {/* Footer — price + cars count */}
                <div className="flex items-center justify-between text-xs gap-2">
                  <span className="text-gray-500">
                    {roll.price ? formatCurrency(roll.price, lang) : '—'}
                  </span>
                  {roll.carsCount > 0 && (
                    <Badge className="bg-[#03DAC6]/15 text-[#03DAC6] border-[#03DAC6]/30 text-[10px] px-1.5 py-0">
                      🚗 {roll.carsCount} {lang === 'ar' ? 'سيارة' : 'cars'}
                    </Badge>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Add Roll Dialog */}
      <AddRollDialog open={showAddDialog} onOpenChange={setShowAddDialog} onSuccess={loadRolls} />

      {/* Consumption Dialog */}
      <ConsumptionDialog
        open={showConsumptionDialog}
        onOpenChange={setShowConsumptionDialog}
        rolls={rolls}
        preselectedRoll={selectedRoll}
        onSuccess={loadRolls}
      />
    </div>
  )
}

// ─── Add Roll Dialog ─────────────────────────────────
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
      toast.error(lang === 'ar' ? 'الماركة والنوع والطول مطلوبة' : 'Brand, type and length required')
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
        throw new Error(err.error || (lang === 'ar' ? 'فشل الإضافة' : 'Failed'))
      }
      const result = await res.json()
      toast.success(lang === 'ar' ? `تم إضافة الرول ${result.code} بنجاح` : `Added roll ${result.code}`)
      setForm({ code: '', brand: '', type: '', model: '', width: '', totalLength: '', price: '', supplier: '', purchaseDate: '', notes: '', rollCategory: 'ppf' })
      onOpenChange(false)
      onSuccess()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  // Auto-suggest code based on brand + type
  const suggestedCode = form.brand && form.type
    ? `${form.brand.slice(0, 3).toUpperCase()}-${form.type.slice(0, 3).toUpperCase()}-${String(Math.floor(Math.random() * 900) + 100)}`
    : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0A0A0A] border-white/10 text-white max-w-lg max-h-[90vh] overflow-y-auto" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="text-white">{lang === 'ar' ? 'إضافة رول جديد' : 'Add New Roll'}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          {/* Code is OPTIONAL with suggestion */}
          <div>
            <Label className="text-gray-400 text-xs">
              {lang === 'ar' ? 'كود الرول (اختياري)' : 'Roll Code (optional)'}
            </Label>
            <Input
              value={form.code}
              onChange={e => setForm({ ...form, code: e.target.value })}
              placeholder={suggestedCode || 'HXS-BF-001'}
              className="bg-[#000] border-white/10 text-white mt-1"
            />
            {suggestedCode && !form.code && (
              <button
                onClick={() => setForm({ ...form, code: suggestedCode })}
                className="text-[10px] text-[#DC143C] hover:underline mt-1"
              >
                {lang === 'ar' ? `استخدم: ${suggestedCode}` : `Use: ${suggestedCode}`}
              </button>
            )}
          </div>
          {/* Category selector */}
          <div>
            <Label className="text-gray-400 text-xs">{lang === 'ar' ? 'الفئة' : 'Category'}</Label>
            <select
              value={form.rollCategory}
              onChange={e => setForm({ ...form, rollCategory: e.target.value })}
              className="w-full bg-[#000] border border-white/10 rounded-md px-3 py-2 text-white mt-1"
            >
              <option value="ppf">{lang === 'ar' ? 'بروتيكشن PPF' : 'PPF Protection'}</option>
              <option value="thermal_long">{lang === 'ar' ? 'عزل طويل' : 'Thermal Long'}</option>
              <option value="thermal_short">{lang === 'ar' ? 'عزل قصير' : 'Thermal Short'}</option>
            </select>
          </div>
          <Field label={`${lang === 'ar' ? 'الماركة' : 'Brand'} *`} value={form.brand} onChange={v => setForm({ ...form, brand: v })} placeholder="Hexis" />
          <Field label={`${lang === 'ar' ? 'النوع' : 'Type'} *`} value={form.type} onChange={v => setForm({ ...form, type: v })} placeholder="Body Fence" />
          <Field label={lang === 'ar' ? 'الموديل' : 'Model'} value={form.model} onChange={v => setForm({ ...form, model: v })} placeholder="Glossy" />
          <Field label={`${lang === 'ar' ? 'العرض (م)' : 'Width (m)'}`} value={form.width} onChange={v => setForm({ ...form, width: v })} placeholder="1.52" type="number" />
          <Field label={`${lang === 'ar' ? 'الطول الإجمالي (م)' : 'Total Length (m)'} *`} value={form.totalLength} onChange={v => setForm({ ...form, totalLength: v })} placeholder="15" type="number" />
          <Field label={`${lang === 'ar' ? 'السعر' : 'Price'} (${t('egp')})`} value={form.price} onChange={v => setForm({ ...form, price: v })} placeholder="18500" type="number" />
          <Field label={`${lang === 'ar' ? 'المورد' : 'Supplier'}`} value={form.supplier} onChange={v => setForm({ ...form, supplier: v })} placeholder="Al-Banna" />
          <Field label={lang === 'ar' ? 'تاريخ الشراء' : 'Purchase Date'} value={form.purchaseDate} onChange={v => setForm({ ...form, purchaseDate: v })} type="date" />
          <div className="col-span-2">
            <Label className="text-gray-400 text-xs">{t('notes')}</Label>
            <Textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              className="bg-[#000] border-white/10 text-white mt-1"
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-gray-400">{t('cancel')}</Button>
          <Button onClick={handleSubmit} disabled={saving} className="prestige-gradient border-0">
            {saving ? t('saving') : (lang === 'ar' ? 'إضافة الرول' : 'Add Roll')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Consumption Dialog ──────────────────────────────
function ConsumptionDialog({ open, onOpenChange, rolls, preselectedRoll, onSuccess }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  rolls: Roll[]
  preselectedRoll: Roll | null
  onSuccess: () => void
}) {
  const [form, setForm] = useState({
    rollCode: '', date: new Date().toISOString().split('T')[0],
    clientName: '', carType: '', plateNumber: '',
    metersUsed: '', waste: '', usageArea: '', workOrder: '', notes: '', technician: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (preselectedRoll) {
      setForm(f => ({ ...f, rollCode: preselectedRoll.code }))
    }
  }, [preselectedRoll])

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
      toast.success(`تم تسجيل استهلاك ${form.metersUsed}م من ${form.rollCode}. المتبقي: ${result.newRemaining.toFixed(2)}م`)
      setForm({
        rollCode: '', date: new Date().toISOString().split('T')[0],
        clientName: '', carType: '', plateNumber: '',
        metersUsed: '', waste: '', usageArea: '', workOrder: '', notes: '', technician: '',
      })
      onOpenChange(false)
      onSuccess()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const activeRolls = rolls.filter(r => r.status !== 'finished')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0A0A0A] border-white/10 text-white max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-white">تسجيل استهلاك رول</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="col-span-2">
            <Label className="text-gray-400 text-xs">الرول *</Label>
            <select
              value={form.rollCode}
              onChange={e => setForm({ ...form, rollCode: e.target.value })}
              className="w-full bg-[#000] border border-white/10 rounded-md px-3 py-2 text-white mt-1"
            >
              <option value="">— اختر الرول —</option>
              {activeRolls.map(r => (
                <option key={r.id} value={r.code}>
                  {r.code} · {r.brand} {r.type} (متبقي {r.remainingLength?.toFixed(1)}م)
                </option>
              ))}
            </select>
          </div>
          <Field label="التاريخ" value={form.date} onChange={v => setForm({ ...form, date: v })} type="date" />
          <Field label="اسم العميل" value={form.clientName} onChange={v => setForm({ ...form, clientName: v })} />
          <Field label="نوع السيارة" value={form.carType} onChange={v => setForm({ ...form, carType: v })} />
          <Field label="رقم اللوحة" value={form.plateNumber} onChange={v => setForm({ ...form, plateNumber: v })} />
          <Field label="الأمتار المستهلكة (م) *" value={form.metersUsed} onChange={v => setForm({ ...form, metersUsed: v })} type="number" />
          <Field label="الهالك (م)" value={form.waste} onChange={v => setForm({ ...form, waste: v })} type="number" />
          <Field label="جهة الاستخدام" value={form.usageArea} onChange={v => setForm({ ...form, usageArea: v })} placeholder="Front Fender" />
          <Field label="رقم أمر الشغل" value={form.workOrder} onChange={v => setForm({ ...form, workOrder: v })} placeholder="OB-0001" />
          <Field label="الفني" value={form.technician} onChange={v => setForm({ ...form, technician: v })} />
          <div className="col-span-2">
            <Label className="text-gray-400 text-xs">ملاحظات</Label>
            <Textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              className="bg-[#000] border-white/10 text-white mt-1"
              rows={2}
            />
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

// ─── Field helper ────────────────────────────────────
function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div>
      <Label className="text-gray-400 text-xs">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-[#000] border-white/10 text-white mt-1 placeholder:text-gray-600"
      />
    </div>
  )
}
