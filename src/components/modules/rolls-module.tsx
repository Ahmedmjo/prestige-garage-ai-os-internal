'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Film, Plus, Search, Package, TrendingDown, AlertTriangle,
  CheckCircle2, XCircle, Pencil, Trash2, DollarSign, History, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog'
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

interface Consumption {
  id: string
  rollId: string
  rollCode: string
  date: string
  clientName: string | null
  carType: string | null
  plateNumber: string | null
  metersUsed: number
  waste: number
  usageArea: string | null
  workOrder: string | null
  notes: string | null
  technician: string | null
  transactionType: string | null
}

// Status labels are localized inline below
// Color thresholds (matching protection module):
//   remaining > 5m  → active (green #00C853)
//   2m < remaining ≤ 5m → low (yellow #FFD600 — pure yellow, distinct from orange)
//   0m < remaining ≤ 2m → critical (orange-red #FF4500)
//   remaining ≤ 0m → finished (red #DC143C)

const STATUS_CONFIG = (lang: 'ar' | 'en'): Record<string, { label: string; color: string; bg: string; icon: any }> => ({
  active: { label: lang === 'ar' ? 'نشط' : 'Active', color: '#00C853', bg: 'rgba(0,200,83,0.12)', icon: CheckCircle2 },
  low: { label: lang === 'ar' ? 'أوشك على النفاذ' : 'Running Low', color: '#FFD600', bg: 'rgba(255,214,0,0.12)', icon: AlertTriangle },
  critical: { label: lang === 'ar' ? 'حرج' : 'Critical', color: '#FF4500', bg: 'rgba(255,69,0,0.12)', icon: AlertTriangle },
  finished: { label: lang === 'ar' ? 'منتهي' : 'Finished', color: '#DC143C', bg: 'rgba(220,20,60,0.12)', icon: XCircle },
})

// Compute status from remaining length using thresholds
function computeRollStatus(remaining: number): 'active' | 'low' | 'critical' | 'finished' {
  if (remaining <= 0) return 'finished'
  if (remaining <= 2) return 'critical'
  if (remaining <= 5) return 'low'
  return 'active'
}

export function RollsModule() {
  const { t, lang } = useI18n()
  const [rolls, setRolls] = useState<Roll[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showConsumptionDialog, setShowConsumptionDialog] = useState(false)
  const [selectedRoll, setSelectedRoll] = useState<Roll | null>(null)
  const [editRoll, setEditRoll] = useState<Roll | null>(null)
  const [deleteRoll, setDeleteRoll] = useState<Roll | null>(null)
  const [editPriceRoll, setEditPriceRoll] = useState<Roll | null>(null)
  const [showConsumptionsList, setShowConsumptionsList] = useState(false)
  const [consumptions, setConsumptions] = useState<Consumption[]>([])
  const [editConsumption, setEditConsumption] = useState<Consumption | null>(null)
  const [deleteConsumption, setDeleteConsumption] = useState<Consumption | null>(null)
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

  async function loadConsumptions() {
    try {
      const res = await fetch('/api/consumptions')
      const data = await res.json()
      setConsumptions(data)
    } catch (e) {
      toast.error('فشل تحميل الاستهلاكات')
    }
  }

  const stats = {
    total: rolls.length,
    active: rolls.filter(r => computeRollStatus(r.remainingLength || 0) === 'active').length,
    low: rolls.filter(r => computeRollStatus(r.remainingLength || 0) === 'low').length,
    critical: rolls.filter(r => computeRollStatus(r.remainingLength || 0) === 'critical').length,
    finished: rolls.filter(r => computeRollStatus(r.remainingLength || 0) === 'finished').length,
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
    const matchesStatus = statusFilter === 'all' || computeRollStatus(r.remainingLength || 0) === statusFilter
    const matchesCategory = categoryFilter === 'all' || r.rollCategory === categoryFilter
    return matchesSearch && matchesStatus && matchesCategory
  })

  async function handleDeleteRoll(r: Roll) {
    try {
      const res = await fetch(`/api/rolls/${r.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'فشل الحذف')
      }
      toast.success(`تم حذف الرول ${r.code}`)
      setDeleteRoll(null)
      loadRolls()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  async function handleDeleteConsumption(c: Consumption) {
    try {
      const res = await fetch(`/api/consumptions/${c.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'فشل الحذف')
      }
      const result = await res.json()
      toast.success(result.message)
      setDeleteConsumption(null)
      loadRolls()
      if (showConsumptionsList) loadConsumptions()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

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
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={() => {
              loadConsumptions()
              setShowConsumptionsList(true)
            }}
            variant="outline"
            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
          >
            <History size={16} className="ml-1" />
            سجل الاستهلاك
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
        <div className="flex gap-1 bg-[#0A0A0A] border border-white/10 rounded-lg p-1 flex-wrap">
          {[
            { id: 'all', label: 'الكل', color: '#FFFFFF' },
            { id: 'active', label: 'نشط', color: '#00C853' },
            { id: 'low', label: 'منخفض', color: '#FFD600' },
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
              style={statusFilter !== f.id ? { color: f.color } : {}}
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
            // Use computed status based on remaining length (not DB status field)
            const computedStatus = computeRollStatus(roll.remainingLength || 0)
            const status = statusConfig[computedStatus] || statusConfig.active
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
                className="prestige-card p-5 group"
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

                {/* Footer — price + cars count + actions */}
                <div className="flex items-center justify-between text-xs gap-2 mb-3">
                  <span className="text-gray-500">
                    {roll.price ? formatCurrency(roll.price, lang) : '—'}
                  </span>
                  {roll.carsCount && roll.carsCount > 0 ? (
                    <Badge className="bg-[#03DAC6]/15 text-[#03DAC6] border-[#03DAC6]/30 text-[10px] px-1.5 py-0">
                      🚗 {roll.carsCount} {lang === 'ar' ? 'سيارة' : 'cars'}
                    </Badge>
                  ) : null}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1 pt-3 border-t border-white/5">
                  <button
                    onClick={() => setEditRoll(roll)}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md hover:bg-[#03DAC6]/15 text-[#03DAC6] text-xs transition-colors"
                    title={lang === 'ar' ? 'تعديل بيانات الرول' : 'Edit roll data'}
                  >
                    <Pencil size={12} />
                    {lang === 'ar' ? 'تعديل' : 'Edit'}
                  </button>
                  <button
                    onClick={() => setEditPriceRoll(roll)}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md hover:bg-[#00C853]/15 text-[#00C853] text-xs transition-colors"
                    title={lang === 'ar' ? 'تعديل السعر فقط' : 'Edit price only'}
                  >
                    <DollarSign size={12} />
                    {lang === 'ar' ? 'السعر' : 'Price'}
                  </button>
                  <button
                    onClick={() => {
                      setSelectedRoll(roll)
                      setShowConsumptionDialog(true)
                    }}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md hover:bg-[#FF9100]/15 text-[#FF9100] text-xs transition-colors"
                    title={lang === 'ar' ? 'تسجيل استهلاك' : 'Record consumption'}
                  >
                    <TrendingDown size={12} />
                    {lang === 'ar' ? 'استهلاك' : 'Use'}
                  </button>
                  <button
                    onClick={() => setDeleteRoll(roll)}
                    className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-md hover:bg-[#DC143C]/15 text-[#DC143C] text-xs transition-colors"
                    title={lang === 'ar' ? 'حذف الرول' : 'Delete roll'}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Add Roll Dialog */}
      <AddRollDialog open={showAddDialog} onOpenChange={setShowAddDialog} onSuccess={loadRolls} existingRolls={rolls} />

      {/* Edit Roll Dialog */}
      {editRoll && (
        <EditRollDialog
          roll={editRoll}
          open={!!editRoll}
          onOpenChange={(v) => !v && setEditRoll(null)}
          onSuccess={loadRolls}
        />
      )}

      {/* Edit Price Dialog */}
      {editPriceRoll && (
        <EditPriceDialog
          roll={editPriceRoll}
          open={!!editPriceRoll}
          onOpenChange={(v) => !v && setEditPriceRoll(null)}
          onSuccess={loadRolls}
        />
      )}

      {/* Consumption Dialog */}
      <ConsumptionDialog
        open={showConsumptionDialog}
        onOpenChange={setShowConsumptionDialog}
        rolls={rolls}
        preselectedRoll={selectedRoll}
        onSuccess={loadRolls}
      />

      {/* Consumptions List Dialog */}
      <ConsumptionsListDialog
        open={showConsumptionsList}
        onOpenChange={setShowConsumptionsList}
        consumptions={consumptions}
        onEdit={setEditConsumption}
        onDelete={setDeleteConsumption}
        onRefresh={loadConsumptions}
      />

      {/* Edit Consumption Dialog */}
      {editConsumption && (
        <EditConsumptionDialog
          consumption={editConsumption}
          rolls={rolls}
          open={!!editConsumption}
          onOpenChange={(v) => !v && setEditConsumption(null)}
          onSuccess={() => {
            loadRolls()
            if (showConsumptionsList) loadConsumptions()
          }}
        />
      )}

      {/* Delete Roll Confirmation */}
      {deleteRoll && (
        <AlertDialog open={!!deleteRoll} onOpenChange={(v) => !v && setDeleteRoll(null)}>
          <AlertDialogContent className="bg-[#0A0A0A] border-white/10 text-white" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">{lang === 'ar' ? 'تأكيد حذف الرول' : 'Confirm Roll Deletion'}</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-400">
                {lang === 'ar'
                  ? `هل أنت متأكد من حذف الرول ${deleteRoll.code} (${deleteRoll.brand} ${deleteRoll.type})؟ لا يمكن التراجع عن هذا الإجراء.`
                  : `Are you sure you want to delete roll ${deleteRoll.code} (${deleteRoll.brand} ${deleteRoll.type})? This cannot be undone.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="text-gray-400">{t('cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleDeleteRoll(deleteRoll)}
                className="bg-[#DC143C] text-white hover:bg-[#DC143C]/80"
              >
                {lang === 'ar' ? 'حذف' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Delete Consumption Confirmation */}
      {deleteConsumption && (
        <AlertDialog open={!!deleteConsumption} onOpenChange={(v) => !v && setDeleteConsumption(null)}>
          <AlertDialogContent className="bg-[#0A0A0A] border-white/10 text-white" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">{lang === 'ar' ? 'تأكيد حذف سجل الاستهلاك' : 'Confirm Consumption Deletion'}</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-400">
                {lang === 'ar'
                  ? `هل أنت متأكد من حذف سجل استهلاك ${deleteConsumption.metersUsed}م من الرول ${deleteConsumption.rollCode}؟ سيتم استرجاع الأمتار للرول.`
                  : `Are you sure you want to delete the consumption of ${deleteConsumption.metersUsed}m from roll ${deleteConsumption.rollCode}? The meters will be restored to the roll.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="text-gray-400">{t('cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleDeleteConsumption(deleteConsumption)}
                className="bg-[#DC143C] text-white hover:bg-[#DC143C]/80"
              >
                {lang === 'ar' ? 'حذف' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}

// ─── Add Roll Dialog ─────────────────────────────────
function AddRollDialog({ open, onOpenChange, onSuccess, existingRolls }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSuccess: () => void
  existingRolls: Roll[]
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

  // ─── Live roll-code suggestion (real next sequence — no randomness) ───
  // Computes the next sequence for the brand+type prefix from existing rolls.
  // Auto-fills the code field (editable — user can change the sequence number).
  // Triggered from brand/type/category onChange (not useEffect) to avoid cascading renders.
  function computeSuggestedCode(brand: string, type: string): string {
    const bp = brand.slice(0, 3).toUpperCase()
    const tp = type.slice(0, 3).toUpperCase()
    if (!bp || !tp) return ''
    const re = new RegExp(`^${bp}-${tp}-(\\d+)$`, 'i')
    let max = 0
    for (const r of existingRolls) {
      const m = (r.code || '').match(re)
      if (m) { const n = parseInt(m[1], 10); if (n > max) max = n }
    }
    return `${bp}-${tp}-${String(max + 1).padStart(3, '0')}`
  }

  const suggestedCode = computeSuggestedCode(form.brand, form.type)

  // ─── Helper codes: existing rolls matching the current brand+type prefix ───
  // Shows up to 5 existing codes with the same pattern as a reference,
  // so the user can see the naming convention and pick the right sequence.
  const matchingCodes = (form.brand && form.type)
    ? existingRolls
        .filter(r => {
          const bp = form.brand.slice(0, 3).toUpperCase()
          const tp = form.type.slice(0, 3).toUpperCase()
          return (r.code || '').toUpperCase().startsWith(`${bp}-${tp}-`)
        })
        .sort((a, b) => (b.code || '').localeCompare(a.code || ''))
        .slice(0, 5)
        .map(r => r.code)
    : []

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
              list="roll-codes-list"
              className="bg-[#000] border-white/10 text-white mt-1"
            />
            <datalist id="roll-codes-list">
              {existingRolls.map(r => (
                <option key={r.id} value={r.code}>{r.code} — {r.brand} {r.type} ({r.status})</option>
              ))}
            </datalist>
            {suggestedCode && !form.code && (
              <button
                onClick={() => setForm({ ...form, code: suggestedCode })}
                className="text-[10px] text-[#DC143C] hover:underline mt-1"
              >
                {lang === 'ar' ? `استخدم: ${suggestedCode}` : `Use: ${suggestedCode}`}
              </button>
            )}
            {matchingCodes.length > 0 && (
              <div className="mt-2 p-2 bg-[#0A0A0A] border border-white/5 rounded">
                <p className="text-[10px] text-gray-500 mb-1">
                  {lang === 'ar' ? 'أكواد موجودة بنفس النمط:' : 'Existing codes with same pattern:'}
                </p>
                <div className="flex flex-wrap gap-1">
                  {matchingCodes.map(c => (
                    <span key={c} className="text-[10px] font-mono text-[#03DAC6] bg-[#03DAC6]/10 px-1.5 py-0.5 rounded cursor-pointer hover:bg-[#03DAC6]/20" onClick={() => setForm(prev => ({ ...prev, code: c }))}>
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* Category selector */}
          <div>
            <Label className="text-gray-400 text-xs">{lang === 'ar' ? 'الفئة' : 'Category'}</Label>
            <select
              value={form.rollCategory}
              onChange={e => {
                const cat = e.target.value
                setForm(prev => {
                  // Auto-suggest "THM" type prefix for thermal-insulation rolls (العزل الحراري).
                  // THM = Thermal (distinctive — NOT THF, because THF is used by the
                  // thermal-insulation SERVICE code in the services section).
                  // Only prefills when type is empty (user can override).
                  const newType = (cat === 'thermal_long' || cat === 'thermal_short') && !prev.type ? 'THM' : prev.type
                  const nextCode = computeSuggestedCode(prev.brand, newType)
                  return { ...prev, rollCategory: cat, type: newType, code: nextCode || prev.code }
                })
              }}
              className="w-full bg-[#000] border border-white/10 rounded-md px-3 py-2 text-white mt-1"
            >
              <option value="ppf">{lang === 'ar' ? 'بروتيكشن PPF' : 'PPF Protection'}</option>
              <option value="thermal_long">{lang === 'ar' ? 'عزل طويل' : 'Thermal Long'}</option>
              <option value="thermal_short">{lang === 'ar' ? 'عزل قصير' : 'Thermal Short'}</option>
            </select>
          </div>
          <Field label={`${lang === 'ar' ? 'الماركة' : 'Brand'} *`} value={form.brand} onChange={v => setForm(prev => ({ ...prev, brand: v, code: computeSuggestedCode(v, prev.type) || prev.code }))} placeholder="Hexis" />
          <Field label={`${lang === 'ar' ? 'النوع' : 'Type'} *`} value={form.type} onChange={v => setForm(prev => ({ ...prev, type: v, code: computeSuggestedCode(prev.brand, v) || prev.code }))} placeholder="Body Fence" />
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

// ─── Edit Roll Dialog ─────────────────────────────────
function EditRollDialog({ roll, open, onOpenChange, onSuccess }: {
  roll: Roll
  open: boolean
  onOpenChange: (v: boolean) => void
  onSuccess: () => void
}) {
  const { t, lang } = useI18n()
  const [form, setForm] = useState({
    code: roll.code,
    brand: roll.brand,
    type: roll.type,
    model: roll.model || '',
    width: roll.width ? String(roll.width) : '',
    totalLength: String(roll.totalLength),
    price: roll.price ? String(roll.price) : '',
    supplier: roll.supplier || '',
    purchaseDate: roll.purchaseDate ? new Date(roll.purchaseDate).toISOString().split('T')[0] : '',
    notes: roll.notes || '',
    rollCategory: roll.rollCategory || 'ppf',
  })
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    setSaving(true)
    try {
      const res = await fetch(`/api/rolls/${roll.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || (lang === 'ar' ? 'فشل التعديل' : 'Failed'))
      }
      toast.success(lang === 'ar' ? `تم تعديل الرول ${form.code} بنجاح` : `Updated roll ${form.code}`)
      onOpenChange(false)
      onSuccess()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0A0A0A] border-white/10 text-white max-w-lg max-h-[90vh] overflow-y-auto" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Pencil size={18} className="text-[#03DAC6]" />
            {lang === 'ar' ? `تعديل الرول ${roll.code}` : `Edit Roll ${roll.code}`}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div>
            <Label className="text-gray-400 text-xs">{lang === 'ar' ? 'كود الرول' : 'Roll Code'}</Label>
            <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} className="bg-[#000] border-white/10 text-white mt-1" />
          </div>
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
          <Field label={`${lang === 'ar' ? 'الماركة' : 'Brand'}`} value={form.brand} onChange={v => setForm({ ...form, brand: v })} />
          <Field label={`${lang === 'ar' ? 'النوع' : 'Type'}`} value={form.type} onChange={v => setForm({ ...form, type: v })} />
          <Field label={lang === 'ar' ? 'الموديل' : 'Model'} value={form.model} onChange={v => setForm({ ...form, model: v })} />
          <Field label={`${lang === 'ar' ? 'العرض (م)' : 'Width (m)'}`} value={form.width} onChange={v => setForm({ ...form, width: v })} type="number" />
          <Field label={`${lang === 'ar' ? 'الطول الإجمالي (م)' : 'Total Length (m)'}`} value={form.totalLength} onChange={v => setForm({ ...form, totalLength: v })} type="number" />
          <Field label={`${lang === 'ar' ? 'السعر' : 'Price'} (${t('egp')})`} value={form.price} onChange={v => setForm({ ...form, price: v })} type="number" />
          <Field label={`${lang === 'ar' ? 'المورد' : 'Supplier'}`} value={form.supplier} onChange={v => setForm({ ...form, supplier: v })} />
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
            {saving ? t('saving') : (lang === 'ar' ? 'حفظ التعديلات' : 'Save Changes')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Edit Price Dialog (quick price edit) ─────────────
function EditPriceDialog({ roll, open, onOpenChange, onSuccess }: {
  roll: Roll
  open: boolean
  onOpenChange: (v: boolean) => void
  onSuccess: () => void
}) {
  const { t, lang } = useI18n()
  const [price, setPrice] = useState(roll.price ? String(roll.price) : '')
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    setSaving(true)
    try {
      const res = await fetch(`/api/rolls/${roll.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || (lang === 'ar' ? 'فشل تعديل السعر' : 'Failed'))
      }
      toast.success(lang === 'ar' ? `تم تحديث سعر الرول ${roll.code} إلى ${price} ج.م` : `Updated price for ${roll.code}`)
      onOpenChange(false)
      onSuccess()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0A0A0A] border-white/10 text-white max-w-md" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <DollarSign size={18} className="text-[#00C853]" />
            {lang === 'ar' ? `تعديل سعر الرول ${roll.code}` : `Edit Price for ${roll.code}`}
          </DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-3">
          <div className="text-sm text-gray-400">
            {roll.brand} · {roll.type} {roll.model ? `· ${roll.model}` : ''}
          </div>
          <div>
            <Label className="text-gray-400 text-xs">{lang === 'ar' ? 'السعر (ج.م)' : 'Price (EGP)'}</Label>
            <Input
              type="number"
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder={lang === 'ar' ? 'أدخل السعر' : 'Enter price'}
              className="bg-[#000] border-white/10 text-white mt-1 text-lg"
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-gray-400">{t('cancel')}</Button>
          <Button onClick={handleSubmit} disabled={saving} className="prestige-gradient border-0">
            {saving ? t('saving') : (lang === 'ar' ? 'حفظ السعر' : 'Save Price')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Edit Consumption Dialog ─────────────────────────
function EditConsumptionDialog({ consumption, rolls, open, onOpenChange, onSuccess }: {
  consumption: Consumption
  rolls: Roll[]
  open: boolean
  onOpenChange: (v: boolean) => void
  onSuccess: () => void
}) {
  const { t, lang } = useI18n()
  const [form, setForm] = useState({
    rollCode: consumption.rollCode,
    date: new Date(consumption.date).toISOString().split('T')[0],
    clientName: consumption.clientName || '',
    carType: consumption.carType || '',
    plateNumber: consumption.plateNumber || '',
    metersUsed: String(consumption.metersUsed),
    waste: String(consumption.waste || ''),
    usageArea: consumption.usageArea || '',
    workOrder: consumption.workOrder || '',
    notes: consumption.notes || '',
    technician: consumption.technician || '',
    transactionType: consumption.transactionType || 'استهلاك',
  })
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    if (!form.rollCode || (!form.metersUsed && !form.waste)) {
      toast.error('كود الرول مطلوب — ضع الأمتار أو الهالك')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/consumptions/${consumption.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'فشل التعديل')
      }
      const result = await res.json()
      toast.success(`تم تعديل سجل الاستهلاك. الرصيد الجديد: ${result.newRemaining.toFixed(2)}م`)
      onOpenChange(false)
      onSuccess()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0A0A0A] border-white/10 text-white max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Pencil size={18} className="text-[#03DAC6]" />
            تعديل سجل الاستهلاك
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="col-span-2">
            <Label className="text-gray-400 text-xs">الرول *</Label>
            <select
              value={form.rollCode}
              onChange={e => setForm({ ...form, rollCode: e.target.value })}
              className="w-full bg-[#000] border border-white/10 rounded-md px-3 py-2 text-white mt-1"
            >
              {rolls.map(r => (
                <option key={r.id} value={r.code}>
                  {r.code} · {r.brand} {r.type} (متبقي {r.remainingLength?.toFixed(1)}م)
                </option>
              ))}
            </select>
          </div>
          <Field label="التاريخ" value={form.date} onChange={v => setForm({ ...form, date: v })} type="date" />
          <Field label="رقم أمر الشغل (OB)" value={form.workOrder} onChange={v => setForm({ ...form, workOrder: v })} placeholder="OB-0001" />
          <Field label="اسم العميل" value={form.clientName} onChange={v => setForm({ ...form, clientName: v })} />
          <Field label="نوع السيارة" value={form.carType} onChange={v => setForm({ ...form, carType: v })} />
          <Field label="رقم اللوحة" value={form.plateNumber} onChange={v => setForm({ ...form, plateNumber: v })} />
          <Field label="الفني" value={form.technician} onChange={v => setForm({ ...form, technician: v })} />
          <Field label="الأمتار المستهلكة (م) *" value={form.metersUsed} onChange={v => setForm({ ...form, metersUsed: v })} type="number" />
          <Field label="الهالك (م)" value={form.waste} onChange={v => setForm({ ...form, waste: v })} type="number" />
          <Field label="جهة الاستخدام" value={form.usageArea} onChange={v => setForm({ ...form, usageArea: v })} placeholder="Front Fender" />
          <Field label="نوع الحركة" value={form.transactionType} onChange={v => setForm({ ...form, transactionType: v })} />
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
            {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Consumptions List Dialog ────────────────────────
function ConsumptionsListDialog({ open, onOpenChange, consumptions, onEdit, onDelete, onRefresh }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  consumptions: Consumption[]
  onEdit: (c: Consumption) => void
  onDelete: (c: Consumption) => void
  onRefresh: () => void
}) {
  const { t, lang } = useI18n()
  const [search, setSearch] = useState('')

  const filtered = consumptions.filter(c => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      c.rollCode?.toLowerCase().includes(s) ||
      c.clientName?.toLowerCase().includes(s) ||
      c.workOrder?.toLowerCase().includes(s) ||
      c.carType?.toLowerCase().includes(s)
    )
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0A0A0A] border-white/10 text-white max-w-5xl max-h-[90vh] overflow-hidden flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center justify-between">
            <span className="flex items-center gap-2">
              <History size={18} className="text-[#FF9100]" />
              سجل الاستهلاك ({consumptions.length})
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              className="text-gray-400 hover:text-white"
            >
              {lang === 'ar' ? 'تحديث' : 'Refresh'}
            </Button>
          </DialogTitle>
        </DialogHeader>
        <div className="relative mb-3">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
          <Input
            placeholder="بحث بالكود أو العميل أو رقم الشغل..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-[#0A0A0A] border-white/10 text-white pr-10"
          />
        </div>
        <div className="overflow-y-auto flex-1">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-gray-500">لا توجد سجلات</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#0A0A0A]">
                <tr className="border-b border-white/5 text-right">
                  <th className="py-2 px-3 text-gray-400 font-medium">التاريخ</th>
                  <th className="py-2 px-3 text-gray-400 font-medium">OB</th>
                  <th className="py-2 px-3 text-gray-400 font-medium">الرول</th>
                  <th className="py-2 px-3 text-gray-400 font-medium">العميل</th>
                  <th className="py-2 px-3 text-gray-400 font-medium">السيارة</th>
                  <th className="py-2 px-3 text-gray-400 font-medium">الأمتار</th>
                  <th className="py-2 px-3 text-gray-400 font-medium">الهالك</th>
                  <th className="py-2 px-3 text-gray-400 font-medium">جهة الاستخدام</th>
                  <th className="py-2 px-3 text-gray-400 font-medium text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className="border-b border-white/5 hover:bg-white/3">
                    <td className="py-2 px-3 text-gray-300 text-xs">{new Date(c.date).toLocaleDateString('en-GB')}</td>
                    <td className="py-2 px-3 font-mono text-[#03DAC6] text-xs">{c.workOrder || '-'}</td>
                    <td className="py-2 px-3 font-mono text-[#FF9100] text-xs">{c.rollCode}</td>
                    <td className="py-2 px-3 text-white text-xs">{c.clientName || '-'}</td>
                    <td className="py-2 px-3 text-gray-300 text-xs">{c.carType || '-'}</td>
                    <td className="py-2 px-3 text-white font-bold text-xs">{c.metersUsed}م</td>
                    <td className="py-2 px-3 text-gray-400 text-xs">{c.waste || 0}م</td>
                    <td className="py-2 px-3 text-gray-400 text-xs max-w-[150px] truncate" title={c.usageArea || ''}>{c.usageArea || '-'}</td>
                    <td className="py-2 px-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onEdit(c)}
                          className="p-1 rounded hover:bg-[#03DAC6]/20 text-[#03DAC6]"
                          title="تعديل"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => onDelete(c)}
                          className="p-1 rounded hover:bg-[#DC143C]/20 text-[#DC143C]"
                          title="حذف"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
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
    if (!form.rollCode || (!form.metersUsed && !form.waste)) {
      toast.error('كود الرول مطلوب — ضع الأمتار أو الهالك')
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
