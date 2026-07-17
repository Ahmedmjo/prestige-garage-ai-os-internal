'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Package, Plus, Search, ArrowDownCircle, ArrowUpCircle, Trash2,
  AlertTriangle, XCircle, CheckCircle2,
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
import { formatNumber } from '@/lib/i18n'

interface StockItem {
  id: string
  name: string
  category: string
  unit: string
  totalReceived: number
  totalWithdrawn: number
  currentQty: number
  minLevel: number
  status: string
  unitPrice: number
}

// NOTE: "detailing" is written exactly as "detailing" in DB; UI displays "دتيلنج" (this exact spelling)
const CATEGORIES = [
  { id: 'all', label_ar: 'الكل', label_en: 'All', icon: '📦' },
  { id: 'detailing', label_ar: 'دتيلنج', label_en: 'Detailing', icon: '🧴' },
  { id: 'polish', label_ar: 'بوليش', label_en: 'Polish', icon: '✨' },
  { id: 'nano', label_ar: 'نانو سيراميك', label_en: 'Nano Ceramic', icon: '💎' },
  { id: 'tools', label_ar: 'أدوات ومعدات', label_en: 'Tools', icon: '🔧' },
]

const STATUS_CONFIG: Record<string, { label_ar: string; label_en: string; color: string; bg: string; icon: any }> = {
  'كافي': { label_ar: 'كافي', label_en: 'OK', color: '#00C853', bg: 'rgba(0,200,83,0.12)', icon: CheckCircle2 },
  'منخفض': { label_ar: 'منخفض', label_en: 'Low', color: '#FF9100', bg: 'rgba(255,145,0,0.12)', icon: AlertTriangle },
  'نفد': { label_ar: 'نفد', label_en: 'Out', color: '#DC143C', bg: 'rgba(220,20,60,0.12)', icon: XCircle },
}

export function StockModule() {
  const { t, lang } = useI18n()
  const [items, setItems] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [showMovementDialog, setShowMovementDialog] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null)

  useEffect(() => {
    loadItems()
  }, [category])

  async function loadItems() {
    setLoading(true)
    try {
      const res = await fetch(`/api/stock${category !== 'all' ? `?category=${category}` : ''}`)
      const data = await res.json()
      setItems(data)
    } catch (e) {
      toast.error(lang === 'ar' ? 'فشل تحميل المخزون' : 'Failed to load stock')
    } finally {
      setLoading(false)
    }
  }

  const filtered = items.filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()))

  const stats = {
    total: items.length,
    low: items.filter(i => i.status === 'منخفض').length,
    out: items.filter(i => i.status === 'نفد').length,
    value: items.reduce((s, i) => s + (i.currentQty * i.unitPrice), 0),
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
            <Package className="text-[#BB86FC]" />
            {t('stockManagement')}
          </h1>
          <p className="text-gray-400 mt-1">{t('stockDesc')}</p>
        </div>
        <Button
          onClick={() => setShowAddDialog(true)}
          className="prestige-gradient border-0 hover:opacity-90"
        >
          <Plus size={16} className="ml-1" />
          {lang === 'ar' ? 'صنف جديد' : 'New Item'}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="prestige-card p-4">
          <p className="text-xs text-gray-400">{t('totalItems')}</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="prestige-card p-4">
          <p className="text-xs text-gray-400">{t('lowStock')}</p>
          <p className="text-2xl font-bold text-[#FF9100] mt-1">{stats.low}</p>
        </div>
        <div className="prestige-card p-4">
          <p className="text-xs text-gray-400">{t('outOfStock')}</p>
          <p className="text-2xl font-bold text-[#DC143C] mt-1">{stats.out}</p>
        </div>
        <div className="prestige-card p-4">
          <p className="text-xs text-gray-400">{t('inventoryValue')}</p>
          <p className="text-xl font-bold text-white mt-1">{formatNumber(Math.round(stats.value), lang)}</p>
          <p className="text-xs text-gray-500">{t('egp')}</p>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 bg-[#0A0A0A] border border-white/10 rounded-lg p-1 flex-wrap">
        {CATEGORIES.map(c => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={`px-3 py-1.5 rounded-md text-sm transition-all flex items-center gap-1.5 ${
              category === c.id ? 'bg-[#DC143C] text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <span>{c.icon}</span>
            {lang === 'ar' ? c.label_ar : c.label_en}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
        <Input
          placeholder={t('searchItem')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-[#0A0A0A] border-white/10 text-white pr-10 placeholder:text-gray-600"
        />
      </div>

      {/* Items table */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">{t('loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">{lang === 'ar' ? 'لا توجد أصناف' : 'No items'}</div>
      ) : (
        <div className="prestige-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-right">
                  <th className="py-3 px-4 text-gray-400 font-medium">{t('item')}</th>
                  <th className="py-3 px-4 text-gray-400 font-medium">{t('category')}</th>
                  <th className="py-3 px-4 text-gray-400 font-medium">{t('unit')}</th>
                  <th className="py-3 px-4 text-gray-400 font-medium">{t('received')}</th>
                  <th className="py-3 px-4 text-gray-400 font-medium">{t('withdrawn')}</th>
                  <th className="py-3 px-4 text-gray-400 font-medium">{t('current')}</th>
                  <th className="py-3 px-4 text-gray-400 font-medium">{t('minLevel')}</th>
                  <th className="py-3 px-4 text-gray-400 font-medium">{t('status')}</th>
                  <th className="py-3 px-4 text-gray-400 font-medium">{t('action')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, idx) => {
                  const status = STATUS_CONFIG[item.status] || STATUS_CONFIG['كافي']
                  const StatusIcon = status.icon
                  return (
                    <motion.tr
                      key={item.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.02 }}
                      className="border-b border-white/5 hover:bg-white/3"
                    >
                      <td className="py-3 px-4 text-white font-medium">{item.name}</td>
                      <td className="py-3 px-4 text-gray-400">
                        {CATEGORIES.find(c => c.id === item.category)?.[lang === 'ar' ? 'label_ar' : 'label_en'] || item.category}
                      </td>
                      <td className="py-3 px-4 text-gray-400">{item.unit}</td>
                      <td className="py-3 px-4 text-gray-300">{formatNumber(item.totalReceived, lang)}</td>
                      <td className="py-3 px-4 text-gray-300">{formatNumber(item.totalWithdrawn, lang)}</td>
                      <td className="py-3 px-4 font-bold text-white">{formatNumber(item.currentQty, lang)}</td>
                      <td className="py-3 px-4 text-gray-500">{formatNumber(item.minLevel, lang)}</td>
                      <td className="py-3 px-4">
                        <Badge
                          style={{ background: status.bg, color: status.color, borderColor: status.color + '40' }}
                          className="border text-xs flex items-center gap-1 w-fit"
                        >
                          <StatusIcon size={10} />
                          {lang === 'ar' ? status.label_ar : status.label_en}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          <button
                            onClick={() => { setSelectedItem(item); setShowMovementDialog(true) }}
                            className="p-1.5 rounded-md bg-[#00C853]/15 text-[#00C853] hover:bg-[#00C853]/25"
                            title={t('receive')}
                          >
                            <ArrowDownCircle size={14} />
                          </button>
                          <button
                            onClick={() => { setSelectedItem(item); setShowMovementDialog(true) }}
                            className="p-1.5 rounded-md bg-[#FF9100]/15 text-[#FF9100] hover:bg-[#FF9100]/25"
                            title={t('withdraw')}
                          >
                            <ArrowUpCircle size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item)}
                            className="p-1.5 rounded-md bg-[#DC143C]/15 text-[#DC143C] hover:bg-[#DC143C]/25"
                            title={t('delete')}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <MovementDialog open={showMovementDialog} onOpenChange={setShowMovementDialog} item={selectedItem} onSuccess={loadItems} />
      <AddItemDialog open={showAddDialog} onOpenChange={setShowAddDialog} onSuccess={loadItems} existingItems={items} />
    </div>
  )

  async function handleDeleteItem(item: StockItem) {
    if (!confirm(lang === 'ar' ? `حذف "${item.name}"؟` : `Delete "${item.name}"?`)) return
    try {
      await fetch(`/api/stock/${item.id}`, { method: 'DELETE' })
      toast.success(lang === 'ar' ? 'تم حذف الصنف' : 'Item deleted')
      loadItems()
    } catch (e: any) {
      toast.error(e.message)
    }
  }
}

function MovementDialog({ open, onOpenChange, item, onSuccess }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  item: StockItem | null
  onSuccess: () => void
}) {
  const { t, lang } = useI18n()
  const [form, setForm] = useState({
    movementType: 'استلام',
    quantity: '', unitPrice: '',
    date: new Date().toISOString().split('T')[0],
    notes: '', deliveryNote: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (item) {
      setForm({
        movementType: 'استلام',
        quantity: '',
        unitPrice: String(item.unitPrice || ''),
        date: new Date().toISOString().split('T')[0],
        notes: '', deliveryNote: '',
      })
    }
  }, [item, open])

  async function handleSubmit() {
    if (!item || !form.quantity) {
      toast.error(t('required'))
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/stock/${item.id}/movements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || (lang === 'ar' ? 'فشل التسجيل' : 'Failed'))
      }
      toast.success(lang === 'ar' ? `تم ${form.movementType} ${form.quantity} ${item.unit} من ${item.name}` : `Movement recorded`)
      onOpenChange(false)
      onSuccess()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (!item) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0A0A0A] border-white/10 text-white max-w-md" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="text-white">{lang === 'ar' ? 'حركة مخزون' : 'Stock Movement'} — {item.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="bg-white/5 rounded-lg p-3 text-sm flex justify-between">
            <span className="text-gray-400">{lang === 'ar' ? 'الرصيد الحالي:' : 'Current:'}</span>
            <span className="font-bold text-white">{formatNumber(item.currentQty, lang)} {item.unit}</span>
          </div>
          <div>
            <Label className="text-gray-400 text-xs">{t('movementType')}</Label>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => setForm({ ...form, movementType: 'استلام' })}
                className={`flex-1 py-2 rounded-md text-sm font-medium ${
                  form.movementType === 'استلام'
                    ? 'bg-[#00C853]/20 text-[#00C853] border border-[#00C853]/40'
                    : 'bg-white/5 text-gray-400 border border-white/10'
                }`}
              >
                <ArrowDownCircle size={14} className="inline ml-1" />
                {t('receive')}
              </button>
              <button
                onClick={() => setForm({ ...form, movementType: 'سحب' })}
                className={`flex-1 py-2 rounded-md text-sm font-medium ${
                  form.movementType === 'سحب'
                    ? 'bg-[#FF9100]/20 text-[#FF9100] border border-[#FF9100]/40'
                    : 'bg-white/5 text-gray-400 border border-white/10'
                }`}
              >
                <ArrowUpCircle size={14} className="inline ml-1" />
                {t('withdraw')}
              </button>
            </div>
          </div>
          <div>
            <Label className="text-gray-400 text-xs">{t('quantity')} ({item.unit}) *</Label>
            <Input type="number" step="any" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} className="bg-[#000] border-white/10 text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">{t('unitPrice')} ({t('egp')})</Label>
            <Input type="number" step="any" value={form.unitPrice} onChange={e => setForm({ ...form, unitPrice: e.target.value })} className="bg-[#000] border-white/10 text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">{t('deliveryNote')}</Label>
            <Input value={form.deliveryNote} onChange={e => setForm({ ...form, deliveryNote: e.target.value })} className="bg-[#000] border-white/10 text-white mt-1" placeholder="DN 1234" />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">{t('notes')}</Label>
            <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="bg-[#000] border-white/10 text-white mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-gray-400">{t('cancel')}</Button>
          <Button onClick={handleSubmit} disabled={saving} className="prestige-gradient border-0">
            {saving ? t('saving') : (lang === 'ar' ? 'تسجيل الحركة' : 'Record Movement')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AddItemDialog({ open, onOpenChange, onSuccess, existingItems }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSuccess: () => void
  existingItems: StockItem[]
}) {
  const { t, lang } = useI18n()
  const [form, setForm] = useState({
    name: '', category: 'detailing', unit: 'ml',
    currentQty: '', minLevel: '', unitPrice: '',
  })
  const [saving, setSaving] = useState(false)

  // ─── Suggested stock code (next sequence for the selected category) ───
  // Format: STL-001 (polish), STD-001 (detailing), STN-001 (nano), STT-001 (tools)
  const STOCK_PREFIXES: Record<string, string> = {
    polish: 'STL', detailing: 'STD', nano: 'STN', tools: 'STT',
  }
  function computeSuggestedCode(cat: string): string {
    const prefix = STOCK_PREFIXES[cat] || 'STT'
    const re = new RegExp(`^${prefix}-(\\d+)$`, 'i')
    let max = 0
    for (const it of existingItems) {
      const m = (it.code || '').match(re)
      if (m) { const n = parseInt(m[1], 10); if (n > max) max = n }
    }
    return `${prefix}-${String(max + 1).padStart(3, '0')}`
  }
  const suggestedCode = computeSuggestedCode(form.category)

  // Existing items with the same name (prevents duplicates)
  const matchingItems = form.name
    ? existingItems.filter(it => it.name.toLowerCase().includes(form.name.toLowerCase())).slice(0, 5)
    : []

  async function handleSubmit() {
    if (!form.name) {
      toast.error(t('required'))
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || (lang === 'ar' ? 'فشل الإضافة' : 'Failed'))
      }
      toast.success(lang === 'ar' ? `تم إضافة ${form.name}` : `Added ${form.name}`)
      setForm({ name: '', category: 'detailing', unit: 'ml', currentQty: '', minLevel: '', unitPrice: '' })
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
          <DialogTitle className="text-white">{lang === 'ar' ? 'صنف جديد' : 'New Stock Item'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-gray-400 text-xs">{t('item')} *</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} list="stock-names-list" className="bg-[#000] border-white/10 text-white mt-1" placeholder="Sonax Active Foam 2L" />
            <datalist id="stock-names-list">
              {existingItems.map(it => (
                <option key={it.id} value={it.name}>{it.code} — {it.category} ({it.currentQty} {it.unit})</option>
              ))}
            </datalist>
            {/* Suggested code for the new item */}
            <p className="text-[10px] text-gray-500 mt-1">
              {lang === 'ar' ? `الكود المقترح: ` : `Suggested code: `}
              <span className="font-mono text-[#BB86FC]">{suggestedCode}</span>
            </p>
            {/* Show matching existing items to prevent duplicates */}
            {matchingItems.length > 0 && (
              <div className="mt-2 p-2 bg-[#0A0A0A] border border-white/5 rounded">
                <p className="text-[10px] text-gray-500 mb-1">
                  {lang === 'ar' ? 'أصناف موجودة مشابهة:' : 'Similar existing items:'}
                </p>
                <div className="flex flex-wrap gap-1">
                  {matchingItems.map(it => (
                    <span key={it.id} className="text-[10px] font-mono text-[#03DAC6] bg-[#03DAC6]/10 px-1.5 py-0.5 rounded">
                      {it.code} — {it.name} ({it.currentQty} {it.unit})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div>
            <Label className="text-gray-400 text-xs">{t('category')}</Label>
            <select
              value={form.category}
              onChange={e => {
                const cat = e.target.value
                // Auto-set unit based on category
                const defaultUnit = cat === 'detailing' ? 'ml' : cat === 'polish' || cat === 'nano' ? 'pack' : 'unit'
                setForm({ ...form, category: cat, unit: defaultUnit })
              }}
              className="w-full bg-[#000] border border-white/10 rounded-md px-3 py-2 text-white mt-1"
            >
              <option value="detailing">{lang === 'ar' ? 'دتيلنج' : 'Detailing'}</option>
              <option value="polish">{lang === 'ar' ? 'بوليش' : 'Polish'}</option>
              <option value="nano">{lang === 'ar' ? 'نانو سيراميك' : 'Nano Ceramic'}</option>
              <option value="tools">{lang === 'ar' ? 'أدوات ومعدات' : 'Tools'}</option>
            </select>
          </div>
          <div>
            <Label className="text-gray-400 text-xs">{t('unit')}</Label>
            <select
              value={form.unit}
              onChange={e => setForm({ ...form, unit: e.target.value })}
              className="w-full bg-[#000] border border-white/10 rounded-md px-3 py-2 text-white mt-1"
            >
              <option value="ml">{lang === 'ar' ? 'مليلتر (ml)' : 'Milliliter (ml)'}</option>
              <option value="liter">{lang === 'ar' ? 'لتر' : 'Liter'}</option>
              <option value="pack">{lang === 'ar' ? 'عبوة' : 'Pack'}</option>
              <option value="unit">{lang === 'ar' ? 'وحدة' : 'Unit'}</option>
              <option value="meter">{lang === 'ar' ? 'متر' : 'Meter'}</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-gray-400 text-xs">{t('current')} *</Label>
              <Input type="number" step="any" value={form.currentQty} onChange={e => setForm({ ...form, currentQty: e.target.value })} className="bg-[#000] border-white/10 text-white mt-1" />
            </div>
            <div>
              <Label className="text-gray-400 text-xs">{t('minLevel')}</Label>
              <Input type="number" step="any" value={form.minLevel} onChange={e => setForm({ ...form, minLevel: e.target.value })} className="bg-[#000] border-white/10 text-white mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-gray-400 text-xs">{t('unitPrice')} ({t('egp')})</Label>
            <Input type="number" step="any" value={form.unitPrice} onChange={e => setForm({ ...form, unitPrice: e.target.value })} className="bg-[#000] border-white/10 text-white mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-gray-400">{t('cancel')}</Button>
          <Button onClick={handleSubmit} disabled={saving} className="prestige-gradient border-0">
            {saving ? t('saving') : t('add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
