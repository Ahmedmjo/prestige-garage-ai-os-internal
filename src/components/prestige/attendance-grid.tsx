'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Save, X, Check, AlertCircle, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n-context'
import { formatNumber } from '@/lib/i18n'

interface Employee {
  id: string
  name: string
  jobTitle: string | null
  baseSalary: number
}

interface AttendanceGridProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  employees: Employee[]
  preselectedEmp: Employee | null
  month: number
  year: number
  onSuccess: () => void
}

// Status options
const STATUS_OPTIONS = [
  { value: 'ح', label_ar: 'ح', label_en: 'P', color: '#00C853', bg: 'rgba(0,200,83,0.15)' },
  { value: 'غ', label: 'غ', label_en: 'A', color: '#DC143C', bg: 'rgba(220,20,60,0.15)' },
  { value: 'إ', label_ar: 'إ', label_en: 'L', color: '#03DAC6', bg: 'rgba(3,218,198,0.15)' },
  { value: 'ر', label_ar: 'ر', label_en: 'W', color: '#888', bg: 'rgba(136,136,136,0.15)' },
]

// Day names (Arabic) — week starts Saturday in Egypt
const DAY_NAMES_AR = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة']
const DAY_NAMES_EN = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']

export function AttendanceGrid({ open, onOpenChange, employees, preselectedEmp, month, year, onSuccess }: AttendanceGridProps) {
  const { t, lang } = useI18n()
  const [grid, setGrid] = useState<Record<string, Record<number, string>>>({})  // {empId: {day: status}}
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)

  const activeEmployees = employees.filter(e => e.status === 'نشط' || e.status === 'active')

  // Days in month
  const daysInMonth = new Date(year, month, 0).getDate()

  useEffect(() => {
    if (open) {
      loadAttendance()
    }
  }, [open, month, year])

  async function loadAttendance() {
    setLoading(true)
    try {
      const res = await fetch(`/api/attendance/batch?month=${month}&year=${year}`)
      const data = await res.json()
      const newGrid: Record<string, Record<number, string>> = {}
      if (data.byEmployee) {
        for (const [empId, days] of Object.entries(data.byEmployee)) {
          newGrid[empId] = {}
          for (const [day, att] of Object.entries(days as any)) {
            newGrid[empId][Number(day)] = (att as any).status
          }
        }
      }
      setGrid(newGrid)
    } catch (e) {
      toast.error(lang === 'ar' ? 'فشل تحميل الحضور' : 'Failed to load attendance')
    } finally {
      setLoading(false)
    }
  }

  function cycleStatus(empId: string, day: number) {
    const current = grid[empId]?.[day] || ''
    const order = ['', 'ح', 'غ', 'إ', 'ر']
    const idx = order.indexOf(current)
    const next = order[(idx + 1) % order.length]
    setGrid(prev => ({
      ...prev,
      [empId]: { ...(prev[empId] || {}), [day]: next },
    }))
  }

  function setStatus(empId: string, day: number, status: string) {
    setGrid(prev => ({
      ...prev,
      [empId]: { ...(prev[empId] || {}), [day]: status },
    }))
  }

  function getDayName(day: number): string {
    const date = new Date(year, month - 1, day)
    const dayIdx = (date.getDay() + 1) % 7  // Saturday = 0
    return lang === 'ar' ? DAY_NAMES_AR[dayIdx] : DAY_NAMES_EN[dayIdx]
  }

  function isWeekend(day: number): boolean {
    const date = new Date(year, month - 1, day)
    return date.getDay() === 5  // Friday
  }

  async function handleSave() {
    setSaving(true)
    try {
      // إرسال كل الأيام (حتى الفاضية) عشان الـ API يعرف يفرّق بين "عدّل" و"امسح"
      // الأيام الفاضية (status = '') هتتسجل في الـ API عشان تتمسح من الـ DB
      const allEmployeeDays = activeEmployees.map(emp => {
        const empGrid = grid[emp.id] || {}
        const days = Object.entries(empGrid).map(([day, status]) => ({
          day: Number(day),
          status: status || '',  // نحافظ على الـ status الفاضي
        }))
        return { employeeId: emp.id, days }
      }).filter(e => e.days.length > 0)

      if (allEmployeeDays.length === 0) {
        toast.info(lang === 'ar' ? 'لا توجد تغييرات للحفظ' : 'No changes to save')
        return
      }

      // طلب واحد فيه كل الموظفين والأيام
      const res = await fetch('/api/attendance/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month,
          year,
          employees: allEmployeeDays,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || (lang === 'ar' ? 'فشل الحفظ' : 'Save failed'))
      }

      const result = await res.json()
      const msg = lang === 'ar'
        ? `تم الحفظ بنجاح: ${result.created || 0} جديد، ${result.updated || 0} تحديث، ${result.deleted || 0} حذف`
        : `Saved: ${result.created || 0} new, ${result.updated || 0} updated, ${result.deleted || 0} deleted`
      toast.success(msg)
      onOpenChange(false)
      onSuccess()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  // Compute summary per employee
  function getSummary(empId: string) {
    const empGrid = grid[empId] || {}
    let present = 0, absent = 0, leave = 0, weekly = 0
    for (const status of Object.values(empGrid)) {
      if (status === 'ح') present++
      else if (status === 'غ') absent++
      else if (status === 'إ') leave++
      else if (status === 'ر') weekly++
    }
    return { present, absent, leave, weekly }
  }

  const monthNames = lang === 'ar'
    ? ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
    : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0A0A0A] border-white/10 text-white max-w-7xl w-[95vw] max-h-[95vh] overflow-hidden flex flex-col" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Calendar size={20} className="text-[#DC143C]" />
            {t('attendanceGrid')} — {monthNames[month - 1]} {year}
          </DialogTitle>
          <p className="text-xs text-gray-400 mt-1">{t('attendanceGridDesc')}</p>
        </DialogHeader>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 p-3 bg-black/30 rounded-lg border border-white/5">
          {STATUS_OPTIONS.map(s => (
            <div key={s.value} className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-sm border"
                style={{ background: s.bg, color: s.color, borderColor: s.color + '40' }}
              >
                {lang === 'ar' ? s.label_ar : s.label_en}
              </div>
              <span className="text-xs text-gray-400">
                {s.value === 'ح' ? t('legendPresent') :
                 s.value === 'غ' ? t('legendAbsent') :
                 s.value === 'إ' ? t('legendOfficial') :
                 t('legendWeekly')}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-2 mr-auto">
            <span className="text-xs text-gray-500">{lang === 'ar' ? 'اضغط للتبديل' : 'Click to cycle'} →</span>
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-auto border border-white/5 rounded-lg">
          {loading ? (
            <div className="text-center py-12 text-gray-400">{t('loading')}</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[#050505] z-10">
                <tr>
                  <th className="sticky right-0 bg-[#050505] py-2 px-3 text-right text-gray-400 font-medium min-w-[140px] border-l border-white/5">
                    {t('employees')}
                  </th>
                  {/* Day columns */}
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                    const weekend = isWeekend(day)
                    return (
                      <th
                        key={day}
                        className={`py-1 px-1 text-center font-medium min-w-[28px] ${
                          weekend ? 'text-[#FF9100] bg-[#FF9100]/5' : 'text-gray-400'
                        }`}
                      >
                        <div className="font-bold">{day}</div>
                        <div className="text-[9px] text-gray-600">{getDayName(day).slice(0, 3)}</div>
                      </th>
                    )
                  })}
                  {/* Summary columns */}
                  <th className="py-1 px-2 text-center text-[#00C853] font-medium bg-[#00C853]/5 border-r border-white/5">ح</th>
                  <th className="py-1 px-2 text-center text-[#DC143C] font-medium bg-[#DC143C]/5">غ</th>
                  <th className="py-1 px-2 text-center text-gray-400 font-medium bg-white/3">{lang === 'ar' ? 'مدفوع' : 'Paid'}</th>
                </tr>
              </thead>
              <tbody>
                {activeEmployees.map(emp => {
                  const summary = getSummary(emp.id)
                  const paidDays = summary.present + summary.leave
                  return (
                    <tr key={emp.id} className="border-t border-white/5 hover:bg-white/3">
                      <td className="sticky right-0 bg-[#0A0A0A] py-2 px-3 border-l border-white/5">
                        <div className="font-bold text-white text-xs">{emp.name}</div>
                        <div className="text-[10px] text-gray-500">{emp.jobTitle}</div>
                      </td>
                      {/* Day cells */}
                      {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                        const status = grid[emp.id]?.[day] || ''
                        const statusConfig = STATUS_OPTIONS.find(s => s.value === status)
                        const weekend = isWeekend(day)
                        return (
                          <td key={day} className="p-0.5">
                            <button
                              onClick={() => cycleStatus(emp.id, day)}
                              className={`w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs transition-all hover:scale-110 hover:z-10 relative ${
                                weekend && !statusConfig ? 'bg-[#FF9100]/5' : ''
                              }`}
                              style={statusConfig ? {
                                background: statusConfig.bg,
                                color: statusConfig.color,
                                border: `1px solid ${statusConfig.color}40`,
                              } : {
                                background: 'transparent',
                                border: '1px solid rgba(255,255,255,0.05)',
                              }}
                              title={`${emp.name} - ${day} ${monthNames[month - 1]}`}
                            >
                              {status ? (lang === 'ar' ? status : statusConfig?.label_en) : ''}
                            </button>
                          </td>
                        )
                      })}
                      {/* Summary */}
                      <td className="py-1 px-2 text-center font-bold text-[#00C853] bg-[#00C853]/5 border-r border-white/5">
                        {summary.present}
                      </td>
                      <td className="py-1 px-2 text-center font-bold text-[#DC143C] bg-[#DC143C]/5">
                        {summary.absent}
                      </td>
                      <td className="py-1 px-2 text-center font-bold text-white bg-white/3">
                        {paidDays}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer with totals + save */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/5">
          <div className="text-xs text-gray-400">
            {lang === 'ar' ? 'الخلاصة:' : 'Summary:'}{' '}
            <span className="text-[#00C853]">{activeEmployees.length} {lang === 'ar' ? 'موظف' : 'employees'}</span>
            {' · '}
            <span className="text-gray-500">{daysInMonth} {lang === 'ar' ? 'يوم' : 'days'}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-gray-400">
              <X size={14} className="ml-1" />
              {t('cancel')}
            </Button>
            <Button onClick={handleSave} disabled={saving} className="prestige-gradient border-0">
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin ml-1" />
                  {t('saving')}
                </>
              ) : (
                <>
                  <Save size={14} className="ml-1" />
                  {t('saveAttendance')}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
