import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { categorizeService } from '@/lib/i18n'

// ─── Category labels (Arabic) ────────────────────────────────
const CAT_LABELS_AR: Record<string, string> = {
  cat_polish: 'بوليش',
  cat_nano: 'نانو سيراميك',
  cat_detailing: 'دتيلنج',
  cat_thermal: 'عزل حراري وفاميه',
  cat_protection: 'بروتيكشن',
  cat_other: 'أخرى',
}

// GET /api/dashboard — aggregated stats for smart dashboard
export async function GET() {
  try {
    const [
      rolls,
      employees,
      services,
      invoices,
      stockItems,
      alerts,
      consumptions,
      commissions,
      advances,
    ] = await Promise.all([
      db.roll.findMany(),
      db.employee.findMany(),
      db.service.findMany({ orderBy: { date: 'desc' } }),
      db.invoice.findMany(),
      db.stockItem.findMany(),
      db.alert.findMany({ where: { isRead: false }, orderBy: { createdAt: 'desc' } }),
      db.rollConsumption.findMany({ orderBy: { date: 'desc' } }),
      db.commission.findMany(),
      db.advance.findMany(),
    ])

    // Revenue by category (regrouped: polish, nano, detailing, thermal+vamia, protection, other)
    const revenueByCategory: Record<string, { count: number; total: number; label: string }> = {
      cat_polish: { count: 0, total: 0, label: CAT_LABELS_AR.cat_polish },
      cat_nano: { count: 0, total: 0, label: CAT_LABELS_AR.cat_nano },
      cat_detailing: { count: 0, total: 0, label: CAT_LABELS_AR.cat_detailing },
      cat_thermal: { count: 0, total: 0, label: CAT_LABELS_AR.cat_thermal },
      cat_protection: { count: 0, total: 0, label: CAT_LABELS_AR.cat_protection },
      cat_other: { count: 0, total: 0, label: CAT_LABELS_AR.cat_other },
    }
    for (const s of services) {
      const cat = categorizeService(s.serviceType)
      revenueByCategory[cat].count++
      revenueByCategory[cat].total += s.price
    }

    // Also keep the original by-type breakdown for the services module
    const revenueByType: Record<string, { count: number; total: number }> = {}
    for (const s of services) {
      const t = s.serviceType || 'أخرى'
      if (!revenueByType[t]) revenueByType[t] = { count: 0, total: 0 }
      revenueByType[t].count++
      revenueByType[t].total += s.price
    }

    // Monthly revenue (last 6 months)
    const now = new Date()
    const monthlyRevenue: { month: string; revenue: number; count: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthServices = services.filter(s => {
        const sd = new Date(s.date)
        return sd.getMonth() === d.getMonth() && sd.getFullYear() === d.getFullYear()
      })
      const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
      monthlyRevenue.push({
        month: monthNames[d.getMonth()],
        revenue: monthServices.reduce((sum, s) => sum + s.price, 0),
        count: monthServices.length,
      })
    }

    // Inventory value
    const inventoryValue = stockItems.reduce((sum, s) => sum + (s.currentQty * s.unitPrice), 0)
    const rollsValue = rolls.reduce((sum, r) => {
      const remaining = r.remainingLength || 0
      const total = r.totalLength || 1
      const usedRatio = remaining / total
      return sum + ((r.price || 0) * usedRatio)
    }, 0)

    // Attendance summary (current month)
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()
    const monthAttendance = await db.attendance.findMany({
      where: { month: currentMonth, year: currentYear },
    })
    // Normalize status — support both short codes and full words
    const attendanceSummary = {
      present: monthAttendance.filter(a => a.status === 'ح' || a.status === 'حضور').length,
      absent: monthAttendance.filter(a => a.status === 'غ' || a.status === 'غياب').length,
      officialLeave: monthAttendance.filter(a => a.status === 'إ' || a.status === 'إجازة' || a.status === 'إجازة أسبوعية').length,
      weeklyLeave: monthAttendance.filter(a => a.status === 'ر' || a.status === 'راحة').length,
    }

    // ─── Protection (PPF) summary ─────────────────────────────
    // Group consumptions by OB (work order)
    const obGroups: Record<string, any> = {}
    for (const c of consumptions) {
      if (!c.workOrder) continue
      if (!obGroups[c.workOrder]) {
        obGroups[c.workOrder] = {
          workOrder: c.workOrder,
          clientName: c.clientName,
          carType: c.carType,
          date: c.date,
          totalMeters: 0,
          rollsCount: 0,
        }
      }
      obGroups[c.workOrder].totalMeters += c.metersUsed || 0
      obGroups[c.workOrder].rollsCount++
    }
    const obList = Object.values(obGroups).sort((a: any, b: any) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )

    // Next OB number
    const obNumbers = Object.keys(obGroups).filter(w => w.startsWith('OB-'))
    let nextOBNum = 1
    for (const w of obNumbers) {
      const m = w.match(/OB-(\d+)/)
      if (m) {
        const n = parseInt(m[1], 10)
        if (n >= nextOBNum) nextOBNum = n + 1
      }
    }
    const nextOB = `OB-${String(nextOBNum).padStart(4, '0')}`

    // Total meters used (all time)
    const totalMetersUsed = consumptions.reduce((s, c) => s + (c.metersUsed || 0), 0)
    const totalWaste = consumptions.reduce((s, c) => s + (c.waste || 0), 0)

    // Thresholds for roll status
    const lowThreshold = 5
    const criticalThreshold = 2

    const rollsByStatus = {
      active: rolls.filter(r => (r.remainingLength || 0) > lowThreshold).length,
      low: rolls.filter(r => {
        const rem = r.remainingLength || 0
        return rem > criticalThreshold && rem <= lowThreshold
      }).length,
      critical: rolls.filter(r => {
        const rem = r.remainingLength || 0
        return rem > 0 && rem <= criticalThreshold
      }).length,
      finished: rolls.filter(r => (r.remainingLength || 0) <= 0).length,
    }

    // Inventory financial summary
    const rollsFullValue = rolls.reduce((s, r) => s + (r.price || 0), 0)
    const rollsConsumedValue = rolls.reduce((s, r) => {
      const remaining = r.remainingLength || 0
      const total = r.totalLength || 1
      const consumed = total - remaining
      return s + ((r.price || 0) * (consumed / total))
    }, 0)

    // ALL employees with commissions this month — show everyone who has commissions
    const monthCommissions = commissions.filter(c => c.month === currentMonth && c.year === currentYear)
    const employeePerf: Record<string, { commissions: number; services: number }> = {}
    for (const c of monthCommissions) {
      if (!employeePerf[c.employeeName]) employeePerf[c.employeeName] = { commissions: 0, services: 0 }
      employeePerf[c.employeeName].commissions += c.amount
      employeePerf[c.employeeName].services++
    }

    // Consumption by roll type this month
    const monthConsumptions = consumptions.filter(c => {
      const cd = new Date(c.date)
      return cd.getMonth() === currentMonth && cd.getFullYear() === currentYear
    })
    const consumptionByRoll: Record<string, number> = {}
    for (const c of monthConsumptions) {
      const roll = rolls.find(r => r.id === c.rollId)
      const type = roll?.type || 'غير محدد'
      consumptionByRoll[type] = (consumptionByRoll[type] || 0) + c.metersUsed
    }

    // Recent services (last 10)
    const recentServices = services.slice(0, 10).map(s => ({
      code: s.code,
      date: s.date,
      clientName: s.clientName,
      carType: s.carType,
      serviceType: s.serviceType,
      price: s.price,
      technician: s.technician,
    }))

    return NextResponse.json({
      stats: {
        totalRevenue: services.reduce((s, x) => s + x.price, 0),
        rollsCount: rolls.length,
        activeRolls: rollsByStatus.active,
        lowRolls: rollsByStatus.low,
        criticalRolls: rollsByStatus.critical,
        finishedRolls: rollsByStatus.finished,
        employeesCount: employees.filter(e => e.status === 'نشط').length,
        servicesCount: services.length,
        invoicesCount: invoices.length,
        invoicesTotal: invoices.reduce((s, i) => s + i.net, 0),
        stockItemsCount: stockItems.length,
        lowStockCount: stockItems.filter(s => s.status === 'منخفض').length,
        outOfStockCount: stockItems.filter(s => s.status === 'نفد').length,
        inventoryValue: Math.round(inventoryValue),
        rollsValue: Math.round(rollsValue),
        rollsFullValue: Math.round(rollsFullValue),
        rollsConsumedValue: Math.round(rollsConsumedValue),
        unreadAlerts: alerts.length,
        criticalAlerts: alerts.filter(a => a.severity === 'critical').length,
      },
      protection: {
        nextOB,
        totalOBs: obList.length,
        totalMetersUsed: parseFloat(totalMetersUsed.toFixed(2)),
        totalWaste: parseFloat(totalWaste.toFixed(2)),
        recentOBs: obList.slice(0, 5),
        rollsByStatus,
        totalRemainingMeters: parseFloat(rolls.reduce((s, r) => s + (r.remainingLength || 0), 0).toFixed(2)),
      },
      revenueByType: Object.entries(revenueByType).map(([type, v]) => ({
        type,
        count: v.count,
        total: v.total,
        average: v.count > 0 ? Math.round(v.total / v.count) : 0,
      })),
      revenueByCategory: Object.entries(revenueByCategory).map(([key, v]) => ({
        key,
        label: v.label,
        count: v.count,
        total: v.total,
        average: v.count > 0 ? Math.round(v.total / v.count) : 0,
      })),
      monthlyRevenue,
      attendanceSummary,
      employeePerformance: Object.entries(employeePerf)
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.commissions - a.commissions),
      consumptionByRoll: Object.entries(consumptionByRoll).map(([type, meters]) => ({ type, meters })),
      recentServices,
      alerts: alerts.slice(0, 10).map(a => ({
        id: a.id,
        type: a.type,
        severity: a.severity,
        title: a.title,
        message: a.message,
        createdAt: a.createdAt,
      })),
    })
  } catch (e: any) {
    console.error('Dashboard API error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
