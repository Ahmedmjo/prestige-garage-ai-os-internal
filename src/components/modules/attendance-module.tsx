'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Calendar, Search, Plus, Grid3x3, List, Pencil, Trash2,
  UserCheck, UserX, Clock, Coffee,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n-context'
import { AttendanceGrid } from '@/components/prestige/attendance-grid'

interface Employee {
  id: string
  name: string
  jobTitle: string | null
  status: string
}

interface AttendanceRecord {
  id: string
  employeeId: string
  employeeName: string
  date: string
  status: string
  month: number
  year: number
  notes: string | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  'حضور': { label: 'حضور', color: '#00C853', bg: 'rgba(0,200,83,0.12)', icon: UserCheck },
  'ح': { label: 'حضور', color: '#00C853', bg: 'rgba(0,200,83,0.12)', icon: UserCheck },
  'غياب': { label: 'غياب', color: '#DC143C', bg: 'rgba(220,20,60,0.12)', icon: UserX },
  'غ': { label: 'غياب', color: '#DC143C', bg: 'rgba(220,20,60,0.12)', icon: UserX },
  'راحة': { label: 'راحة', color: '#888888', bg: 'rgba(136,136,136,0.12)', icon: Coffee },
  'ر': { label: 'راحة', color: '#888888', bg: 'rgba(136,136,136,0.12)', icon: Coffee },
  'إجازة': { label: 'إجازة', color: '#03DAC6', bg: 'rgba(3,218,198,0.12)', icon: Clock },
  'إ': { label: 'إجازة', color: '#03DAC6', bg: 'rgba(3,218,198,0.12)', icon: Clock },
  'إجازة أسبوعية': { label: 'إجازة أسبوعية', color: '#FF9100', bg: 'rgba(255,145,0,0.12)', icon: Coffee },
}

function normalizeStatus(status: string): string {
  const map: Record<string, string> = {
    'ح': 'حضور',
    'غ': 'غياب',
    'ر': 'راحة',
    'إ': 'إجازة',
    'ا': 'إجازة أسبوعية',
    'أ': 'إجازة أسبوعية',
  }
  return map[status] || status
}

function getStatusConfig(status: string) {
  const normalized = normalizeStatus(status)
  return STATUS_CONFIG[normalized] || { label: status, color: '#888', bg: 'rgba(136,136,136,0.12)', icon: Clock }
}

export function AttendanceModule() {
  const { t, lang } = useI18n()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editRecord, setEditRecord] = useState<AttendanceRecord | null>(null)
  const [deleteRecord, setDeleteRecord] = useState<AttendanceRecord | null>(null)
  const [showGrid, setShowGrid] = useState(false)

  const monthNames = lang === 'ar'
    ? ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
    : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

  useEffect(() => {
    loadData()
  }, [month, year])

  async function loadData() {
    setLoading(true)
    try {
      const [empRes, attRes] = await Promise.all([
        fetch('/api/employees'),
        fetch(`/api/attendance?month=${month}&year=${year}`),
      ])
      const empData = await empRes.json()
      const attData = await attRes.json()
      setEmployees(empData.map((e: any) => ({ id: e.id, name: e.name, jobTitle: e.jobTitle, status: e.status })))
      setRecords(attData)
    } catch (e) {
      toast.error('فشل تحميل البيانات')
    } finally {
      setLoading(false)
    }
  }

  // Group records by employee
  const byEmployee: Record<string, AttendanceRecord[]> = {}
  for (const r of records) {
    if (!byEmployee[r.employeeId]) byEmployee[r.employeeId] = []
    byEmployee[r.employeeId].push(r)
  }

  const filteredEmployees = employees.filter(e =>
    !search || e.name.includes(search) || (e.jobTitle || '').includes(search)
  )

  // Stats
  const stats = {
    total: records.length,
    present: records.filter(r => normalizeStatus(r.status) === 'حضور').length,
    absent: records.filter(r => normalizeStatus(r.status) === 'غياب').length,
    leave: records.filter(r => normalizeStatus(r.status) === 'إجازة' || normalizeStatus(r.status) === 'إجازة أسبوعية').length,
    rest: records.filter(r => normalizeStatus(r.status) === 'راحة').length,
  }

  async function handleDelete(record: AttendanceRecord) {
    try {
      const res = await fetch(`/api/attendance/${record.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'فشل الحذف')
      }
      toast.success('تم حذف السجل')
      setDeleteRecord(null)
      loadData()
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
            <Calendar className="text-[#03DAC6]" />
            الحضور والغياب
          </h1>
          <p className="text-gray-400 mt-1">جدول منفصل لتسجيل حضور وغياب الموظفين — مستقل عن بيانات الموظفين</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
            className="bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
          >
            {monthNames.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
          >
            {[2025, 2026, 2027].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <Button
            onClick={() => setShowGrid(true)}
            variant="outline"
            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
          >
            <Grid3x3 size={16} className="ml-1" />
            شبكة الحضور
          </Button>
          <Button
            onClick={() => setShowAddDialog(true)}
            className="prestige-gradient border-0 hover:opacity-90"
          >
            <Plus size={16} className="ml-1" />
            تسجيل يدوي
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="prestige-card p-4">
          <p className="text-xs text-gray-400">إجمالي السجلات</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="prestige-card p-4" style={{ background: 'rgba(0,200,83,0.05)' }}>
          <div className="flex items-center gap-2 mb-1">
            <UserCheck size={14} className="text-[#00C853]" />
            <p className="text-xs text-gray-400">حضور</p>
          </div>
          <p className="text-2xl font-bold text-[#00C853] mt-1">{stats.present}</p>
        </div>
        <div className="prestige-card p-4" style={{ background: 'rgba(220,20,60,0.05)' }}>
          <div className="flex items-center gap-2 mb-1">
            <UserX size={14} className="text-[#DC143C]" />
            <p className="text-xs text-gray-400">غياب</p>
          </div>
          <p className="text-2xl font-bold text-[#DC143C] mt-1">{stats.absent}</p>
        </div>
        <div className="prestige-card p-4" style={{ background: 'rgba(3,218,198,0.05)' }}>
          <div className="flex items-center gap-2 mb-1">
            <Clock size={14} className="text-[#03DAC6]" />
            <p className="text-xs text-gray-400">إجازة</p>
          </div>
          <p className="text-2xl font-bold text-[#03DAC6] mt-1">{stats.leave}</p>
        </div>
        <div className="prestige-card p-4" style={{ background: 'rgba(136,136,136,0.05)' }}>
          <div className="flex items-center gap-2 mb-1">
            <Coffee size={14} className="text-gray-400" />
            <p className="text-xs text-gray-400">راحة</p>
          </div>
          <p className="text-2xl font-bold text-gray-300 mt-1">{stats.rest}</p>
        </div>
      </div>

      {/* Search + view toggle */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <Input
            placeholder="بحث عن موظف..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-[#0A0A0A] border-white/10 text-white pr-10 placeholder:text-gray-600"
          />
        </div>
        <div className="flex gap-1 bg-[#0A0A0A] border border-white/10 rounded-lg p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1.5 rounded-md text-sm transition-all ${viewMode === 'grid' ? 'bg-[#03DAC6] text-black' : 'text-gray-400 hover:text-white'}`}
          >
            <Grid3x3 size={14} className="inline ml-1" />
            شبكة
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 rounded-md text-sm transition-all ${viewMode === 'list' ? 'bg-[#03DAC6] text-black' : 'text-gray-400 hover:text-white'}`}
          >
            <List size={14} className="inline ml-1" />
            قائمة
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">جاري التحميل...</div>
      ) : viewMode === 'grid' ? (
        // Grid view — per employee summary
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEmployees.map((emp, idx) => {
            const empRecords = byEmployee[emp.id] || []
            const present = empRecords.filter(r => normalizeStatus(r.status) === 'حضور').length
            const absent = empRecords.filter(r => normalizeStatus(r.status) === 'غياب').length
            const leave = empRecords.filter(r => normalizeStatus(r.status) === 'إجازة' || normalizeStatus(r.status) === 'إجازة أسبوعية').length
            const rest = empRecords.filter(r => normalizeStatus(r.status) === 'راحة').length

            return (
              <motion.div
                key={emp.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="prestige-card p-4"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-[#03DAC6]/15 flex items-center justify-center">
                    <span className="text-sm font-bold text-[#03DAC6]">{emp.name.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-white text-sm truncate">{emp.name}</h3>
                    <p className="text-xs text-gray-500">{emp.jobTitle || 'موظف'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="rounded p-2" style={{ background: 'rgba(0,200,83,0.08)' }}>
                    <p className="text-lg font-bold text-[#00C853]">{present}</p>
                    <p className="text-[10px] text-gray-500">حضور</p>
                  </div>
                  <div className="rounded p-2" style={{ background: 'rgba(220,20,60,0.08)' }}>
                    <p className="text-lg font-bold text-[#DC143C]">{absent}</p>
                    <p className="text-[10px] text-gray-500">غياب</p>
                  </div>
                  <div className="rounded p-2" style={{ background: 'rgba(3,218,198,0.08)' }}>
                    <p className="text-lg font-bold text-[#03DAC6]">{leave}</p>
                    <p className="text-[10px] text-gray-500">إجازة</p>
                  </div>
                  <div className="rounded p-2" style={{ background: 'rgba(136,136,136,0.08)' }}>
                    <p className="text-lg font-bold text-gray-300">{rest}</p>
                    <p className="text-[10px] text-gray-500">راحة</p>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      ) : (
        // List view — all records
        <div className="prestige-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-right">
                  <th className="py-3 px-4 text-gray-400 font-medium">الموظف</th>
                  <th className="py-3 px-4 text-gray-400 font-medium">التاريخ</th>
                  <th className="py-3 px-4 text-gray-400 font-medium">الحالة</th>
                  <th className="py-3 px-4 text-gray-400 font-medium">ملاحظات</th>
                  <th className="py-3 px-4 text-gray-400 font-medium text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500">لا توجد سجلات في هذا الشهر</td>
                  </tr>
                ) : (
                  records.map(r => {
                    const st = getStatusConfig(r.status)
                    return (
                      <tr key={r.id} className="border-b border-white/5 hover:bg-white/3">
                        <td className="py-3 px-4 text-white">{r.employeeName}</td>
                        <td className="py-3 px-4 text-gray-300 text-xs">{new Date(r.date).toLocaleDateString('en-GB')}</td>
                        <td className="py-3 px-4">
                          <Badge style={{ background: st.bg, color: st.color, borderColor: st.color + '40' }} className="border text-xs">
                            {st.label}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-gray-400 text-xs">{r.notes || '-'}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setEditRecord(r)}
                              className="p-1 rounded hover:bg-[#03DAC6]/20 text-[#03DAC6]"
                              title="تعديل"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => setDeleteRecord(r)}
                              className="p-1 rounded hover:bg-[#DC143C]/20 text-[#DC143C]"
                              title="حذف"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <AddAttendanceDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        employees={employees}
        month={month}
        year={year}
        onSuccess={loadData}
      />
      {editRecord && (
        <EditAttendanceDialog
          record={editRecord}
          employees={employees}
          open={!!editRecord}
          onOpenChange={(v) => !v && setEditRecord(null)}
          onSuccess={loadData}
        />
      )}
      {deleteRecord && (
        <AlertDialog open={!!deleteRecord} onOpenChange={(v) => !v && setDeleteRecord(null)}>
          <AlertDialogContent className="bg-[#0A0A0A] border-white/10 text-white" dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">تأكيد الحذف</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-400">
                هل أنت متأكد من حذف سجل الحضور: {deleteRecord.employeeName} — {new Date(deleteRecord.date).toLocaleDateString('en-GB')} ({normalizeStatus(deleteRecord.status)})؟
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="text-gray-400">إلغاء</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleDelete(deleteRecord)}
                className="bg-[#DC143C] text-white hover:bg-[#DC143C]/80"
              >
                حذف
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      <AttendanceGrid
        open={showGrid}
        onOpenChange={setShowGrid}
        employees={employees}
        preselectedEmp={null}
        month={month}
        year={year}
        onSuccess={loadData}
      />
    </div>
  )
}

// ─── Add Attendance Dialog ────────────────────────────
function AddAttendanceDialog({ open, onOpenChange, employees, month, year, onSuccess }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  employees: Employee[]
  month: number
  year: number
  onSuccess: () => void
}) {
  const { t, lang } = useI18n()
  const [form, setForm] = useState({
    employeeId: '',
    date: new Date().toISOString().split('T')[0],
    status: 'حضور',
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    if (!form.employeeId) {
      toast.error('اختر الموظف')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'فشل الإضافة')
      }
      toast.success('تم تسجيل الحضور')
      setForm({ employeeId: '', date: new Date().toISOString().split('T')[0], status: 'حضور', notes: '' })
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
      <DialogContent className="bg-[#0A0A0A] border-white/10 text-white max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-white">تسجيل حضور / غياب</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-gray-400 text-xs">الموظف *</Label>
            <select
              value={form.employeeId}
              onChange={e => setForm({ ...form, employeeId: e.target.value })}
              className="w-full bg-[#000] border border-white/10 rounded-md px-3 py-2 text-white mt-1"
            >
              <option value="">— اختر الموظف —</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-gray-400 text-xs">التاريخ *</Label>
            <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="bg-[#000] border-white/10 text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">الحالة *</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {['حضور', 'غياب', 'إجازة', 'راحة'].map(s => {
                const st = getStatusConfig(s)
                return (
                  <button
                    key={s}
                    onClick={() => setForm({ ...form, status: s })}
                    className={`py-2 rounded-md text-sm font-medium border transition-all ${
                      form.status === s
                        ? 'border-2'
                        : 'border border-white/10 bg-white/5 text-gray-400 hover:text-white'
                    }`}
                    style={form.status === s ? {
                      background: st.bg,
                      color: st.color,
                      borderColor: st.color + '40',
                    } : {}}
                  >
                    {s}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <Label className="text-gray-400 text-xs">ملاحظات</Label>
            <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="bg-[#000] border-white/10 text-white mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-gray-400">إلغاء</Button>
          <Button onClick={handleSubmit} disabled={saving} className="prestige-gradient border-0">
            {saving ? 'جاري الحفظ...' : 'تسجيل'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Edit Attendance Dialog ───────────────────────────
function EditAttendanceDialog({ record, employees, open, onOpenChange, onSuccess }: {
  record: AttendanceRecord
  employees: Employee[]
  open: boolean
  onOpenChange: (v: boolean) => void
  onSuccess: () => void
}) {
  const { t, lang } = useI18n()
  const [form, setForm] = useState({
    employeeId: record.employeeId,
    date: new Date(record.date).toISOString().split('T')[0],
    status: normalizeStatus(record.status),
    notes: record.notes || '',
  })
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    setSaving(true)
    try {
      const res = await fetch(`/api/attendance/${record.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          employeeName: employees.find(e => e.id === form.employeeId)?.name || record.employeeName,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'فشل التعديل')
      }
      toast.success('تم تعديل السجل')
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
      <DialogContent className="bg-[#0A0A0A] border-white/10 text-white max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Pencil size={18} className="text-[#03DAC6]" />
            تعديل سجل الحضور
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-gray-400 text-xs">الموظف</Label>
            <select
              value={form.employeeId}
              onChange={e => setForm({ ...form, employeeId: e.target.value })}
              className="w-full bg-[#000] border border-white/10 rounded-md px-3 py-2 text-white mt-1"
            >
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-gray-400 text-xs">التاريخ</Label>
            <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="bg-[#000] border-white/10 text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">الحالة</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {['حضور', 'غياب', 'إجازة', 'راحة'].map(s => {
                const st = getStatusConfig(s)
                return (
                  <button
                    key={s}
                    onClick={() => setForm({ ...form, status: s })}
                    className={`py-2 rounded-md text-sm font-medium border transition-all ${
                      form.status === s ? 'border-2' : 'border border-white/10 bg-white/5 text-gray-400 hover:text-white'
                    }`}
                    style={form.status === s ? {
                      background: st.bg,
                      color: st.color,
                      borderColor: st.color + '40',
                    } : {}}
                  >
                    {s}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <Label className="text-gray-400 text-xs">ملاحظات</Label>
            <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="bg-[#000] border-white/10 text-white mt-1" />
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
