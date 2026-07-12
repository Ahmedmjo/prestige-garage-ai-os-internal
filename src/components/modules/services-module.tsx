'use client'

import { useState, useEffect } from 'react'
import {
  Wrench, Plus, Search, DollarSign, Pencil, Trash2,
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
import { categorizeService, unifyServiceType } from '@/lib/i18n'

interface Service {
  id: string
  code: string
  date: string
  plate: string | null
  clientName: string | null
  carType: string | null
  serviceType: string
  price: number
  paymentMethod: string | null
  technician: string | null
  notes: string | null
}

// Unified service types — "ديتيلنج" (correct), "بروتيكشن" (not فيلم حماية)
const SERVICE_TYPES = [
  'ديتيلنج كامل', 'ديتيلنج داخلي', 'ديتيلنج محرك', 'ديتيلنج سقف', 'ديتيلنج جنوط',
  'بوليش مستوى 1', 'بوليش مستوى 2', 'بوليش مستوى 3', 'تلميع فوانيس',
  'نانو سيراميك 3 سنوات', 'نانو سيراميك 5 سنوات', 'نانو سيراميك 8 سنوات',
  'عزل حراري كامل', 'عزل حراري نصف', 'عزل حراري فاميه',
  'بروتيكشن', 'فاميه كامل', 'فاميه أمامي جانبي',
  'إزالة قطران', 'إزالة فاميه', 'أخرى',
]

const PAYMENT_METHODS = ['كاش', 'تحويل بنكي', 'بطاقة ائتمان', 'إنستاباي', 'آجل']

// Category-based colors (matches dashboard categories)
const CATEGORY_COLORS: Record<string, string> = {
  cat_detailing: '#03DAC6',
  cat_polish: '#FF9100',
  cat_nano: '#BB86FC',
  cat_thermal: '#DC143C',
  cat_protection: '#00C853',
  cat_other: '#888888',
}

function getTypeColor(type: string): string {
  const cat = categorizeService(type)
  return CATEGORY_COLORS[cat] || '#888'
}

export function ServicesModule() {
  const { t, lang } = useI18n()
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editService, setEditService] = useState<Service | null>(null)
  const [deleteService, setDeleteService] = useState<Service | null>(null)

  useEffect(() => {
    loadServices()
  }, [])

  async function loadServices() {
    setLoading(true)
    try {
      const res = await fetch('/api/services')
      const data = await res.json()
      setServices(data)
    } catch (e) {
      toast.error(lang === 'ar' ? 'فشل تحميل الخدمات' : 'Failed to load services')
    } finally {
      setLoading(false)
    }
  }

  const filtered = services.filter(s => {
    const matchesSearch = !search ||
      s.code.toLowerCase().includes(search.toLowerCase()) ||
      (s.clientName || '').includes(search) ||
      (s.carType || '').includes(search) ||
      (s.plate || '').includes(search)
    const matchesType = typeFilter === 'all' || s.serviceType === typeFilter
    return matchesSearch && matchesType
  })

  const stats = {
    total: services.length,
    revenue: services.reduce((s, x) => s + x.price, 0),
    average: services.length > 0 ? services.reduce((s, x) => s + x.price, 0) / services.length : 0,
  }

  // Revenue by type
  const byType: Record<string, { count: number; total: number }> = {}
  for (const s of services) {
    const unifiedType = unifyServiceType(s.serviceType) || 'أخرى'
    if (!byType[unifiedType]) byType[unifiedType] = { count: 0, total: 0 }
    byType[unifiedType].count++
    byType[unifiedType].total += s.price
  }
  const typeStats = Object.entries(byType).sort((a, b) => b[1].total - a[1].total)

  async function handleDelete(s: Service) {
    try {
      const res = await fetch(`/api/services/${s.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'فشل الحذف')
      }
      toast.success(`تم حذف الخدمة ${s.code}`)
      setDeleteService(null)
      loadServices()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
            <Wrench className="text-[#03DAC6]" />
            {t('servicesInvoices')}
          </h1>
          <p className="text-gray-400 mt-1">{t('servicesDesc')}</p>
        </div>
        <Button
          onClick={() => setShowAddDialog(true)}
          className="prestige-gradient border-0 hover:opacity-90"
        >
          <Plus size={16} className="ml-1" />
          {t('newService')}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="prestige-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Wrench size={14} className="text-[#03DAC6]" />
            <p className="text-xs text-gray-400">{t('totalServices')}</p>
          </div>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="prestige-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={14} className="text-[#DC143C]" />
            <p className="text-xs text-gray-400">{lang === 'ar' ? 'إجمالي الإيرادات' : 'Total Revenue'}</p>
          </div>
          <p className="text-xl font-bold text-white mt-1">{new Intl.NumberFormat('en-US').format(stats.revenue)}</p>
          <p className="text-xs text-gray-500">{t('egp')}</p>
        </div>
        <div className="prestige-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={14} className="text-[#00C853]" />
            <p className="text-xs text-gray-400">{t('averagePrice')}</p>
          </div>
          <p className="text-xl font-bold text-white mt-1">{new Intl.NumberFormat('en-US').format(Math.round(stats.average))}</p>
          <p className="text-xs text-gray-500">{t('egp')}</p>
        </div>
        <div className="prestige-card p-4">
          <p className="text-xs text-gray-400 mb-1">{t('serviceTypes')}</p>
          <p className="text-2xl font-bold text-white mt-1">{typeStats.length}</p>
        </div>
      </div>

      {/* Type breakdown — colored cards per category */}
      <div className="prestige-card p-5">
        <h3 className="font-bold text-white mb-3">{t('revenueAnalysis')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {typeStats.map(([type, data]) => {
            const color = getTypeColor(type)
            return (
              <div
                key={type}
                className="rounded-lg p-3"
                style={{
                  background: `linear-gradient(135deg, ${color}15 0%, ${color}08 100%)`,
                  border: `1px solid ${color}30`,
                  borderTop: `2px solid ${color}`,
                  transition: 'transform 0.15s',
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium" style={{ color }}>{type}</span>
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}80` }} />
                </div>
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="text-[10px] text-gray-500">{lang === 'ar' ? 'عدد الخدمات' : 'Count'}</p>
                    <p className="text-lg font-bold" style={{ color }}>{data.count}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] text-gray-500">{t('revenue')}</p>
                    <p className="text-lg font-bold" style={{ color }}>
                      {new Intl.NumberFormat('en-US').format(data.total)}
                    </p>
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] text-gray-500">{lang === 'ar' ? 'المتوسط' : 'Avg'}</p>
                    <p className="text-sm font-semibold" style={{ color, opacity: 0.8 }}>
                      {data.count > 0 ? new Intl.NumberFormat('en-US').format(Math.round(data.total / data.count)) : 0}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <Input
            placeholder={lang === 'ar' ? 'بحث بالكود أو العميل أو السيارة...' : 'Search by code, client or car...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-[#0A0A0A] border-white/10 text-white pr-10 placeholder:text-gray-600"
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
        >
          <option value="all">{lang === 'ar' ? 'كل الأنواع' : 'All Types'}</option>
          {SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Services table */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">{t('loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">{lang === 'ar' ? 'لا توجد خدمات' : 'No services'}</div>
      ) : (
        <div className="prestige-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-right">
                  <th className="py-3 px-4 text-gray-400 font-medium">{t('code')}</th>
                  <th className="py-3 px-4 text-gray-400 font-medium">{t('date')}</th>
                  <th className="py-3 px-4 text-gray-400 font-medium">{t('client')}</th>
                  <th className="py-3 px-4 text-gray-400 font-medium">{t('car')}</th>
                  <th className="py-3 px-4 text-gray-400 font-medium">{t('plate')}</th>
                  <th className="py-3 px-4 text-gray-400 font-medium">{lang === 'ar' ? 'الخدمة' : 'Service'}</th>
                  <th className="py-3 px-4 text-gray-400 font-medium">{lang === 'ar' ? 'تفاصيل' : 'Details'}</th>
                  <th className="py-3 px-4 text-gray-400 font-medium">{t('technician')}</th>
                  <th className="py-3 px-4 text-gray-400 font-medium text-left">{t('price')}</th>
                  <th className="py-3 px-4 text-gray-400 font-medium text-center sticky left-0 bg-[#0A0A0A]">{lang === 'ar' ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-white/5 hover:bg-white/3"
                  >
                    <td className="py-3 px-4 font-mono text-[#DC143C] text-xs">{s.code}</td>
                    <td className="py-3 px-4 text-gray-300">{new Date(s.date).toLocaleDateString('en-GB')}</td>
                    <td className="py-3 px-4 text-white">{s.clientName || '-'}</td>
                    <td className="py-3 px-4 text-gray-300">{s.carType || '-'}</td>
                    <td className="py-3 px-4 text-gray-400 text-xs">{s.plate || '-'}</td>
                    <td className="py-3 px-4">
                      <Badge
                        style={{ background: getTypeColor(s.serviceType) + '20', color: getTypeColor(s.serviceType), borderColor: getTypeColor(s.serviceType) + '40' }}
                        className="border text-xs"
                      >
                        {s.serviceType}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-gray-400 text-xs max-w-[200px]">
                      {s.notes ? (
                        <span className="block truncate" title={s.notes}>{s.notes}</span>
                      ) : (
                        <span className="text-gray-600">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-300">{s.technician || '-'}</td>
                    <td className="py-3 px-4 text-left font-bold text-[#00C853]">
                      {new Intl.NumberFormat('en-US').format(s.price)} {t('egp')}
                    </td>
                    <td className="py-3 px-4 sticky left-0 bg-[#0A0A0A]">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditService(s)
                          }}
                          className="p-1.5 rounded-md hover:bg-[#03DAC6]/20 text-[#03DAC6] transition-colors"
                          title={lang === 'ar' ? 'تعديل' : 'Edit'}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteService(s)
                          }}
                          className="p-1.5 rounded-md hover:bg-[#DC143C]/20 text-[#DC143C] transition-colors"
                          title={lang === 'ar' ? 'حذف' : 'Delete'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AddServiceDialog open={showAddDialog} onOpenChange={setShowAddDialog} onSuccess={loadServices} />
      {editService && (
        <EditServiceDialog
          service={editService}
          open={!!editService}
          onOpenChange={(v) => !v && setEditService(null)}
          onSuccess={loadServices}
        />
      )}
      {deleteService && (
        <AlertDialog open={!!deleteService} onOpenChange={(v) => !v && setDeleteService(null)}>
          <AlertDialogContent className="bg-[#0A0A0A] border-white/10 text-white" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">{lang === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-400">
                {lang === 'ar'
                  ? `هل أنت متأكد من حذف الخدمة ${deleteService.code}؟ سيتم حذف العمولة المرتبطة بها أيضاً. لا يمكن التراجع عن هذا الإجراء.`
                  : `Are you sure you want to delete service ${deleteService.code}? Linked commission will also be deleted. This cannot be undone.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="text-gray-400">{t('cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleDelete(deleteService)}
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

function AddServiceDialog({ open, onOpenChange, onSuccess }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSuccess: () => void
}) {
  const { t, lang } = useI18n()
  const [form, setForm] = useState({
    code: '', date: new Date().toISOString().split('T')[0],
    plate: '', clientName: '', carType: '',
    serviceType: 'ديتيلنج كامل', price: '',
    paymentMethod: 'كاش', technician: '', notes: '',
    commissionAmount: '',
  })
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    if (!form.serviceType || !form.price) {
      toast.error(lang === 'ar' ? 'نوع الخدمة والسعر مطلوبان' : 'Service type and price required')
      return
    }
    // If "أخرى" is selected, require notes
    if (form.serviceType === 'أخرى' && !form.notes) {
      toast.error(lang === 'ar' ? 'يجب تحديد نوع الخدمة في خانة التفاصيل' : 'Must specify service type in details')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || (lang === 'ar' ? 'فشل الإضافة' : 'Failed'))
      }
      toast.success(lang === 'ar' ? 'تم تسجيل الخدمة بنجاح' : 'Service recorded successfully')
      setForm({
        code: '', date: new Date().toISOString().split('T')[0],
        plate: '', clientName: '', carType: '',
        serviceType: 'ديتيلنج كامل', price: '',
        paymentMethod: 'كاش', technician: '', notes: '',
        commissionAmount: '',
      })
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
      <DialogContent className="bg-[#0A0A0A] border-white/10 text-white max-w-2xl max-h-[90vh] overflow-y-auto" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="text-white">{t('newService')}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div>
            <Label className="text-gray-400 text-xs">{t('code')}</Label>
            <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder={lang === 'ar' ? 'تلقائي إذا تُرك فارغاً' : 'Auto if empty'} className="bg-[#000] border-white/10 text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">{t('date')}</Label>
            <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="bg-[#000] border-white/10 text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">{t('client')}</Label>
            <Input value={form.clientName} onChange={e => setForm({ ...form, clientName: e.target.value })} className="bg-[#000] border-white/10 text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">{t('car')}</Label>
            <Input value={form.carType} onChange={e => setForm({ ...form, carType: e.target.value })} placeholder={lang === 'ar' ? 'مرسيدس' : 'Mercedes'} className="bg-[#000] border-white/10 text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">{t('plate')}</Label>
            <Input value={form.plate} onChange={e => setForm({ ...form, plate: e.target.value })} className="bg-[#000] border-white/10 text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">{lang === 'ar' ? 'نوع الخدمة *' : 'Service Type *'}</Label>
            <select
              value={form.serviceType}
              onChange={e => setForm({ ...form, serviceType: e.target.value })}
              className="w-full bg-[#000] border border-white/10 rounded-md px-3 py-2 text-white mt-1"
            >
              {SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {/* Conditional "other details" field — shown only when serviceType is "أخرى" */}
          {form.serviceType === 'أخرى' && (
            <div>
              <Label className="text-[#FF9100] text-xs">{lang === 'ar' ? 'تحديد نوع الخدمة (للأخرى) *' : 'Specify Service Type (Other) *'}</Label>
              <Input
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder={lang === 'ar' ? 'مثال: إزالة قطران، رش أكصدام، خلع شماسة...' : 'e.g. Tar removal, bumper paint...'}
                className="bg-[#000] border-[#FF9100]/30 text-white mt-1"
              />
              <p className="text-[10px] text-gray-500 mt-1">{lang === 'ar' ? 'سيتم حفظ هذا الوصف في خانة الملاحظات' : 'Will be saved in notes field'}</p>
            </div>
          )}
          <div>
            <Label className="text-gray-400 text-xs">{t('price')} ({t('egp')}) *</Label>
            <Input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="bg-[#000] border-white/10 text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">{t('payment')}</Label>
            <select
              value={form.paymentMethod}
              onChange={e => setForm({ ...form, paymentMethod: e.target.value })}
              className="w-full bg-[#000] border border-white/10 rounded-md px-3 py-2 text-white mt-1"
            >
              {PAYMENT_METHODS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-gray-400 text-xs">{t('technician')}</Label>
            <Input value={form.technician} onChange={e => setForm({ ...form, technician: e.target.value })} placeholder={lang === 'ar' ? 'اسم الفني' : 'Technician name'} className="bg-[#000] border-white/10 text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">{lang === 'ar' ? 'العمولة' : 'Commission'} ({t('egp')})</Label>
            <Input type="number" value={form.commissionAmount} onChange={e => setForm({ ...form, commissionAmount: e.target.value })} className="bg-[#000] border-white/10 text-white mt-1" />
          </div>
          {form.serviceType !== 'أخرى' && (
            <div className="col-span-2">
              <Label className="text-gray-400 text-xs">{t('notes')}</Label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="bg-[#000] border-white/10 text-white mt-1" rows={2} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-gray-400">{t('cancel')}</Button>
          <Button onClick={handleSubmit} disabled={saving} className="prestige-gradient border-0">
            {saving ? t('saving') : (lang === 'ar' ? 'تسجيل الخدمة' : 'Record Service')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Edit Service Dialog ─────────────────────────────────
function EditServiceDialog({ service, open, onOpenChange, onSuccess }: {
  service: Service
  open: boolean
  onOpenChange: (v: boolean) => void
  onSuccess: () => void
}) {
  const { t, lang } = useI18n()
  const [form, setForm] = useState({
    code: service.code,
    date: new Date(service.date).toISOString().split('T')[0],
    plate: service.plate || '',
    clientName: service.clientName || '',
    carType: service.carType || '',
    serviceType: service.serviceType,
    price: String(service.price),
    paymentMethod: service.paymentMethod || 'كاش',
    technician: service.technician || '',
    notes: service.notes || '',
    commissionAmount: '',
  })
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    if (!form.serviceType || !form.price) {
      toast.error(lang === 'ar' ? 'نوع الخدمة والسعر مطلوبان' : 'Service type and price required')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/services/${service.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || (lang === 'ar' ? 'فشل التعديل' : 'Failed'))
      }
      toast.success(lang === 'ar' ? 'تم تعديل الخدمة بنجاح' : 'Service updated successfully')
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
      <DialogContent className="bg-[#0A0A0A] border-white/10 text-white max-w-2xl max-h-[90vh] overflow-y-auto" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Pencil size={18} className="text-[#03DAC6]" />
            {lang === 'ar' ? `تعديل الخدمة ${service.code}` : `Edit Service ${service.code}`}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div>
            <Label className="text-gray-400 text-xs">{t('code')}</Label>
            <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} className="bg-[#000] border-white/10 text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">{t('date')}</Label>
            <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="bg-[#000] border-white/10 text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">{t('client')}</Label>
            <Input value={form.clientName} onChange={e => setForm({ ...form, clientName: e.target.value })} className="bg-[#000] border-white/10 text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">{t('car')}</Label>
            <Input value={form.carType} onChange={e => setForm({ ...form, carType: e.target.value })} className="bg-[#000] border-white/10 text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">{t('plate')}</Label>
            <Input value={form.plate} onChange={e => setForm({ ...form, plate: e.target.value })} className="bg-[#000] border-white/10 text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">{lang === 'ar' ? 'نوع الخدمة *' : 'Service Type *'}</Label>
            <select
              value={form.serviceType}
              onChange={e => setForm({ ...form, serviceType: e.target.value })}
              className="w-full bg-[#000] border border-white/10 rounded-md px-3 py-2 text-white mt-1"
            >
              {SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-gray-400 text-xs">{t('price')} ({t('egp')}) *</Label>
            <Input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="bg-[#000] border-white/10 text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">{t('payment')}</Label>
            <select
              value={form.paymentMethod}
              onChange={e => setForm({ ...form, paymentMethod: e.target.value })}
              className="w-full bg-[#000] border border-white/10 rounded-md px-3 py-2 text-white mt-1"
            >
              {PAYMENT_METHODS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-gray-400 text-xs">{t('technician')}</Label>
            <Input value={form.technician} onChange={e => setForm({ ...form, technician: e.target.value })} className="bg-[#000] border-white/10 text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">{lang === 'ar' ? 'العمولة' : 'Commission'} ({t('egp')})</Label>
            <Input type="number" value={form.commissionAmount} onChange={e => setForm({ ...form, commissionAmount: e.target.value })} placeholder={lang === 'ar' ? 'اتركها فارغة للحفاظ على القيمة الحالية' : 'Leave empty to keep current'} className="bg-[#000] border-white/10 text-white mt-1" />
          </div>
          {form.serviceType !== 'أخرى' && (
            <div className="col-span-2">
              <Label className="text-gray-400 text-xs">{t('notes')}</Label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="bg-[#000] border-white/10 text-white mt-1" rows={2} />
            </div>
          )}
          {form.serviceType === 'أخرى' && (
            <div className="col-span-2">
              <Label className="text-[#FF9100] text-xs">{lang === 'ar' ? 'تحديد نوع الخدمة (للأخرى)' : 'Specify Service Type (Other)'}</Label>
              <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="bg-[#000] border-[#FF9100]/30 text-white mt-1" />
            </div>
          )}
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
