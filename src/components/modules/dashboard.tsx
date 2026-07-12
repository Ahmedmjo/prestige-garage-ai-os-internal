'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  DollarSign, Film, Users, Wrench, Package, Bell,
  TrendingUp, AlertTriangle, ArrowLeft, Bot, Shield,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { StatCard } from '@/components/prestige/stat-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useI18n } from '@/lib/i18n-context'
import { formatNumber, formatCurrency } from '@/lib/i18n'

interface DashboardData {
  stats: {
    totalRevenue: number
    rollsCount: number
    activeRolls: number
    lowRolls: number
    criticalRolls?: number
    finishedRolls: number
    employeesCount: number
    servicesCount: number
    invoicesCount: number
    invoicesTotal: number
    stockItemsCount: number
    lowStockCount: number
    outOfStockCount: number
    inventoryValue: number
    rollsValue: number
    rollsFullValue?: number
    rollsConsumedValue?: number
    unreadAlerts: number
    criticalAlerts: number
  }
  protection?: {
    nextOB: string
    totalOBs: number
    totalMetersUsed: number
    totalWaste: number
    recentOBs: any[]
    rollsByStatus: { active: number; low: number; critical: number; finished: number }
    totalRemainingMeters: number
  }
  revenueByType: { type: string; count: number; total: number; average: number }[]
  revenueByCategory: { key: string; label: string; count: number; total: number; average: number }[]
  monthlyRevenue: { month: string; revenue: number; count: number }[]
  attendanceSummary: { present: number; absent: number; officialLeave: number; weeklyLeave: number }
  employeePerformance: { name: string; commissions: number; services: number }[]
  consumptionByRoll: { type: string; meters: number }[]
  recentServices: any[]
  alerts: { id: string; type: string; severity: string; title: string; message: string; createdAt: string }[]
}

interface DashboardProps {
  onNavigate: (tab: any) => void
}

const CATEGORY_COLORS: Record<string, string> = {
  cat_polish: '#FF9100',
  cat_nano: '#BB86FC',
  cat_detailing: '#03DAC6',
  cat_thermal: '#DC143C',
  cat_protection: '#00C853',
  cat_other: '#888888',
}

// Distinct colors per employee for the line chart
const EMPLOYEE_COLORS = [
  '#DC143C', '#00C853', '#FF9100', '#03DAC6',
  '#BB86FC', '#FFD600', '#FF4081', '#3B82F6',
  '#A78BFA', '#34D399', '#FBBF24', '#F87171',
]

// Build a timeline of employee commissions across recent months
// For now we use current month as a single point; can be extended to multi-month
function buildEmployeeTimeline(performance: { name: string; commissions: number; services: number }[]) {
  // Group by month — since we only have current month data, show current month
  // Future: extend API to return multiple months
  const now = new Date()
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const currentMonthName = monthNames[now.getMonth()]

  const dataPoint: any = { month: currentMonthName }
  for (const emp of performance) {
    dataPoint[emp.name] = emp.commissions
  }
  // Add previous month as 0 to show a trend line (placeholder for future data)
  const prevMonthName = monthNames[(now.getMonth() - 1 + 12) % 12]
  const prevDataPoint: any = { month: prevMonthName }
  for (const emp of performance) {
    prevDataPoint[emp.name] = 0
  }
  return [prevDataPoint, dataPoint]
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { t, lang } = useI18n()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full border-4 border-[#DC143C]/20 border-t-[#DC143C] animate-spin" />
          <p className="text-gray-400">{t('loading')}</p>
        </div>
      </div>
    )
  }

  const { stats } = data

  // Localize category labels
  const localizedCategories = (data.revenueByCategory || []).map(c => ({
    ...c,
    localizedLabel: t(c.key as any) || c.label,
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            {lang === 'ar' ? (
              <>مرحباً بك في <span className="prestige-text-gradient">Prestige Garage</span></>
            ) : (
              <>Welcome to <span className="prestige-text-gradient">Prestige Garage</span></>
            )}
          </h1>
          <p className="text-gray-400 mt-1">{t('welcomeSubtitle')}</p>
        </div>
        <Button
          onClick={() => onNavigate('ai')}
          className="prestige-gradient text-white border-0 hover:opacity-90"
        >
          <Bot className="ml-2" size={18} />
          {t('askAssistant')}
        </Button>
      </div>

      {/* AI Quick Suggestions */}
      <div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="prestige-card p-5"
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg prestige-gradient flex items-center justify-center">
            <Bot size={16} />
          </div>
          <h3 className="font-bold text-white">{t('quickSuggestions')}</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            lang === 'ar' ? 'كم رصيد رول Hexis BF-001؟' : 'How much Hexis BF-001 roll balance?',
            lang === 'ar' ? 'من أكثر فني أداءً هذا الشهر؟' : 'Top technician this month?',
            lang === 'ar' ? 'قيمة المخزون المتبقي؟' : 'Remaining inventory value?',
            lang === 'ar' ? 'اعملي تقرير شهري ليونيو' : 'Generate June monthly report',
            lang === 'ar' ? 'أظهر لي الرولات اللي أوشكت على النفاذ' : 'Show rolls running low',
          ].map(q => (
            <button
              key={q}
              onClick={() => onNavigate('ai')}
              className="text-sm px-3 py-2 rounded-lg bg-white/5 border border-white/5 text-gray-300 hover:bg-[#DC143C]/10 hover:border-[#DC143C]/30 hover:text-white transition-all"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title={t('totalRevenue')} value={formatCurrency(stats.totalRevenue, lang)} subtitle={`${stats.servicesCount} ${t('service')}`} icon={DollarSign} color="#DC143C" delay={0.05} />
        <StatCard title={t('activeRolls')} value={formatNumber(stats.activeRolls, lang)} subtitle={`${stats.lowRolls} ${t('lowRolls')}`} icon={Film} color="#FF9100" delay={0.1} />
        <StatCard title={t('activeEmployees')} value={formatNumber(stats.employeesCount, lang)} subtitle={lang === 'ar' ? 'فريق العمل' : 'Team'} icon={Users} color="#00C853" delay={0.15} />
        <StatCard title={t('stockItems')} value={formatNumber(stats.stockItemsCount, lang)} subtitle={`${stats.lowStockCount + stats.outOfStockCount} ${lang === 'ar' ? 'تحتاج طلب' : 'need order'}`} icon={Package} color="#BB86FC" delay={0.2} />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title={t('inventoryValue')} value={formatCurrency(stats.inventoryValue, lang)} icon={TrendingUp} color="#03DAC6" delay={0.25} />
        <StatCard title={t('rollsValue')} value={formatCurrency(stats.rollsValue, lang)} icon={Film} color="#FF9100" delay={0.3} />
        <StatCard title={t('totalInvoices')} value={formatCurrency(stats.invoicesTotal, lang)} subtitle={`${stats.invoicesCount} ${lang === 'ar' ? 'فاتورة' : 'invoices'}`} icon={Wrench} color="#FFD600" delay={0.35} />
        <StatCard title={t('activeAlerts')} value={formatNumber(stats.unreadAlerts, lang)} subtitle={`${stats.criticalAlerts} ${t('critical')}`} icon={Bell} color="#FF1744" delay={0.4} />
      </div>

      {/* Protection (PPF) Quick Stats — new */}
      {data.protection && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.42 }}
          className="prestige-card p-5"
          style={{ background: 'linear-gradient(135deg, rgba(0,200,83,0.06) 0%, rgba(0,200,83,0.02) 100%)', borderTop: '2px solid #00C853' }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Shield size={18} className="text-[#00C853]" />
              <h3 className="font-bold text-white">{lang === 'ar' ? 'لوحة البروتيكشن (PPF)' : 'Protection Dashboard'}</h3>
            </div>
            <button
              onClick={() => onNavigate('protection')}
              className="text-xs text-[#00C853] hover:underline"
            >
              {lang === 'ar' ? 'عرض التفاصيل ←' : 'View details ←'}
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            <div className="text-center">
              <p className="text-xs text-gray-500">{lang === 'ar' ? 'أمر الشغل التالي' : 'Next OB'}</p>
              <p className="text-lg font-bold text-[#00C853] font-mono mt-1">{data.protection.nextOB}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">{lang === 'ar' ? 'إجمالي OBs' : 'Total OBs'}</p>
              <p className="text-lg font-bold text-white mt-1">{data.protection.totalOBs}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">{lang === 'ar' ? 'إجمالي الأمتار' : 'Total Meters'}</p>
              <p className="text-lg font-bold text-[#03DAC6] mt-1">{data.protection.totalMetersUsed.toFixed(1)} م</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">{lang === 'ar' ? 'إجمالي الهالك' : 'Total Waste'}</p>
              <p className="text-lg font-bold text-[#DC143C] mt-1">{data.protection.totalWaste.toFixed(1)} م</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">{lang === 'ar' ? 'المتبقي بالكامل' : 'Total Remaining'}</p>
              <p className="text-lg font-bold text-[#FF9100] mt-1">{data.protection.totalRemainingMeters.toFixed(1)} م</p>
            </div>
          </div>

          {/* Roll status bar */}
          <div className="space-y-2">
            <p className="text-xs text-gray-500">{lang === 'ar' ? 'حالة الرولات' : 'Rolls Status'}</p>
            <div className="flex h-3 rounded-full overflow-hidden">
              <div
                className="bg-[#00C853]"
                style={{ width: `${(data.protection.rollsByStatus.active / Math.max(stats.rollsCount, 1)) * 100}%` }}
                title={`نشط: ${data.protection.rollsByStatus.active}`}
              />
              <div
                className="bg-[#FFD600]"
                style={{ width: `${(data.protection.rollsByStatus.low / Math.max(stats.rollsCount, 1)) * 100}%` }}
                title={`أوشك: ${data.protection.rollsByStatus.low}`}
              />
              <div
                className="bg-[#FF4500]"
                style={{ width: `${(data.protection.rollsByStatus.critical / Math.max(stats.rollsCount, 1)) * 100}%` }}
                title={`حرج: ${data.protection.rollsByStatus.critical}`}
              />
              <div
                className="bg-[#DC143C]"
                style={{ width: `${(data.protection.rollsByStatus.finished / Math.max(stats.rollsCount, 1)) * 100}%` }}
                title={`منتهي: ${data.protection.rollsByStatus.finished}`}
              />
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#00C853]" />
                {data.protection.rollsByStatus.active} {lang === 'ar' ? 'نشط' : 'active'}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#FFD600]" />
                {data.protection.rollsByStatus.low} {lang === 'ar' ? 'أوشك' : 'low'}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#FF4500]" />
                {data.protection.rollsByStatus.critical} {lang === 'ar' ? 'حرج' : 'critical'}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#DC143C]" />
                {data.protection.rollsByStatus.finished} {lang === 'ar' ? 'منتهي' : 'finished'}
              </span>
            </div>
          </div>

          {/* Recent OBs */}
          {data.protection.recentOBs && data.protection.recentOBs.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/5">
              <p className="text-xs text-gray-500 mb-2">{lang === 'ar' ? 'أحدث أوامر الشغل' : 'Recent Work Orders'}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {data.protection.recentOBs.slice(0, 3).map((ob: any, i: number) => (
                  <div key={i} className="rounded-md p-2 bg-white/5 border border-white/5 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-bold text-[#00C853]">{ob.workOrder}</span>
                      <span className="text-gray-500">{new Date(ob.date).toLocaleDateString('en-GB')}</span>
                    </div>
                    <p className="text-white truncate">{ob.clientName || '-'}</p>
                    <p className="text-gray-400 text-[10px]">{ob.totalMeters.toFixed(1)} م · {ob.rollsCount} رولات</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly Revenue Chart — thinner, cleaner */}
        <div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="prestige-card p-5 lg:col-span-2"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-white">{t('monthlyRevenue')}</h3>
              <p className="text-xs text-gray-500">{t('last6Months')}</p>
            </div>
            <Badge className="bg-[#DC143C]/15 text-[#DC143C] border-[#DC143C]/30">
              <TrendingUp size={12} className="ml-1" />
              {data.monthlyRevenue[data.monthlyRevenue.length - 1]?.count || 0} {t('servicesThisMonth')}
            </Badge>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data.monthlyRevenue} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#DC143C" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#DC143C" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="month" stroke="#666" tick={{ fill: '#888', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.05)' }} tickLine={false} />
              <YAxis stroke="#666" tick={{ fill: '#888', fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#0A0A0A', border: '1px solid rgba(220,20,60,0.3)', borderRadius: 8, color: '#fff', fontSize: 12 }}
                formatter={(v: any) => [`${formatNumber(Number(v), lang)} ${t('egp')}`, lang === 'ar' ? 'الإيراد' : 'Revenue']}
              />
              <Area type="monotone" dataKey="revenue" stroke="#DC143C" strokeWidth={1.5} fill="url(#colorRev)" dot={{ r: 3, fill: '#DC143C', strokeWidth: 0 }} activeDot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue by Category Pie (regrouped) */}
        <div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="prestige-card p-5"
        >
          <h3 className="font-bold text-white mb-4">{t('revenueByType')}</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={localizedCategories}
                dataKey="total"
                nameKey="localizedLabel"
                cx="50%"
                cy="50%"
                outerRadius={75}
                innerRadius={42}
                paddingAngle={2}
                stroke="none"
              >
                {localizedCategories.map((entry, idx) => (
                  <Cell key={idx} fill={CATEGORY_COLORS[entry.key] || '#888'} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#0A0A0A', border: '1px solid rgba(220,20,60,0.3)', borderRadius: 8, color: '#fff', fontSize: 12 }}
                formatter={(v: any, n: any) => [`${formatNumber(Number(v), lang)} ${t('egp')}`, n]}
              />
              <Legend wrapperStyle={{ fontSize: 10, color: '#888' }} iconSize={8} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category breakdown cards — uniform colored design */}
      <div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.52 }}
        className="prestige-card p-5"
      >
        <h3 className="font-bold text-white mb-3">{t('revenueByType')}</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {localizedCategories.map((cat) => {
            const color = CATEGORY_COLORS[cat.key] || '#888'
            return (
              <div
                key={cat.key}
                className="rounded-lg p-3 transition-all hover:scale-[1.02]"
                style={{
                  background: `linear-gradient(135deg, ${color}15 0%, ${color}08 100%)`,
                  border: `1px solid ${color}30`,
                  borderTop: `2px solid ${color}`,
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-200 font-medium leading-tight">{cat.localizedLabel}</span>
                  <div className="w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}80` }} />
                </div>
                <p className="text-base font-bold" style={{ color }}>
                  {formatNumber(cat.total, lang)}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {cat.count} {t('service')} · {lang === 'ar' ? 'متوسط' : 'avg'} {formatNumber(cat.average, lang)}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Bottom row: Alerts + Employee Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Alerts */}
        <div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="prestige-card p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-white flex items-center gap-2">
              <AlertTriangle size={18} className="text-[#FF9100]" />
              {t('smartAlerts')}
            </h3>
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white text-xs">
              {t('viewAll')}
            </Button>
          </div>
          <ScrollArea className="h-72 pr-3">
            <div className="space-y-2">
              {data.alerts.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">{t('noNotifications')}</div>
              ) : (
                data.alerts.map((alert, idx) => (
                  <div
                    key={alert.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + idx * 0.03 }}
                    className={`p-3 rounded-lg border-r-2 ${
                      alert.severity === 'critical'
                        ? 'bg-[#DC143C]/8 border-[#DC143C]'
                        : alert.severity === 'warning'
                        ? 'bg-[#FF9100]/8 border-[#FF9100]'
                        : 'bg-white/5 border-gray-500'
                    }`}
                  >
                    <p className="text-sm font-semibold text-white">{alert.title}</p>
                    <p className="text-xs text-gray-400 mt-1">{alert.message}</p>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Employee Performance — line per employee, thin lines */}
        <div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="prestige-card p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-white flex items-center gap-2">
              <Users size={18} className="text-[#00C853]" />
              {t('employeePerformance')}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate('employees')}
              className="text-gray-400 hover:text-white text-xs"
            >
              {t('details')} <ArrowLeft size={12} className="mr-1" />
            </Button>
          </div>
          {data.employeePerformance.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">{lang === 'ar' ? 'لا توجد عمولات هذا الشهر' : 'No commissions this month'}</div>
          ) : (
            <>
              {/* Multi-line chart: one line per employee across recent months */}
              <ResponsiveContainer width="100%" height={220}>
                <LineChart
                  data={buildEmployeeTimeline(data.employeePerformance)}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="month" stroke="#666" tick={{ fill: '#888', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis stroke="#666" tick={{ fill: '#888', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#0A0A0A', border: '1px solid rgba(220,20,60,0.3)', borderRadius: 8, color: '#fff', fontSize: 12 }}
                    formatter={(v: any, name: any) => [`${formatNumber(Number(v), lang)} ${t('egp')}`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 10, color: '#888' }} iconSize={8} iconType="plainline" />
                  {data.employeePerformance.map((emp, idx) => (
                    <Line
                      key={emp.name}
                      type="monotone"
                      dataKey={emp.name}
                      stroke={EMPLOYEE_COLORS[idx % EMPLOYEE_COLORS.length]}
                      strokeWidth={1.5}
                      dot={{ r: 2, strokeWidth: 0 }}
                      activeDot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
              {/* Individual employee cards below */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-4">
                {data.employeePerformance.map((emp, idx) => (
                  <div
                    key={emp.name}
                    className="rounded-md p-2 flex items-center justify-between"
                    style={{
                      background: `${EMPLOYEE_COLORS[idx % EMPLOYEE_COLORS.length]}12`,
                      border: `1px solid ${EMPLOYEE_COLORS[idx % EMPLOYEE_COLORS.length]}30`,
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: EMPLOYEE_COLORS[idx % EMPLOYEE_COLORS.length] }}
                      />
                      <span className="text-xs text-gray-200 truncate">{emp.name}</span>
                    </div>
                    <span className="text-xs font-bold" style={{ color: EMPLOYEE_COLORS[idx % EMPLOYEE_COLORS.length] }}>
                      {formatNumber(emp.commissions, lang)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Recent Services */}
      <div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.65 }}
        className="prestige-card p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white flex items-center gap-2">
            <Wrench size={18} className="text-[#03DAC6]" />
            {t('recentServices')}
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate('services')}
            className="text-gray-400 hover:text-white text-xs"
          >
            {t('viewAll')} <ArrowLeft size={12} className="mr-1" />
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right border-b border-white/5">
                <th className="py-2 px-3 text-gray-400 font-medium">{t('code')}</th>
                <th className="py-2 px-3 text-gray-400 font-medium">{t('date')}</th>
                <th className="py-2 px-3 text-gray-400 font-medium">{t('client')}</th>
                <th className="py-2 px-3 text-gray-400 font-medium">{t('car')}</th>
                <th className="py-2 px-3 text-gray-400 font-medium">{lang === 'ar' ? 'الخدمة' : 'Service'}</th>
                <th className="py-2 px-3 text-gray-400 font-medium text-left">{t('price')}</th>
              </tr>
            </thead>
            <tbody>
              {data.recentServices.map((s, idx) => (
                <tr key={idx} className="border-b border-white/5 hover:bg-white/3">
                  <td className="py-2 px-3 font-mono text-[#DC143C]">{s.code}</td>
                  <td className="py-2 px-3 text-gray-300">{new Date(s.date).toLocaleDateString('en-GB')}</td>
                  <td className="py-2 px-3 text-white">{s.clientName || '-'}</td>
                  <td className="py-2 px-3 text-gray-300">{s.carType || '-'}</td>
                  <td className="py-2 px-3">
                    <Badge className="bg-white/5 text-gray-300 border-white/10 text-xs">{s.serviceType}</Badge>
                  </td>
                  <td className="py-2 px-3 text-left font-bold text-[#00C853]">
                    {formatCurrency(s.price, lang)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
