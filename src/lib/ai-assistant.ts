/**
 * Prestige AI Assistant Engine v4 — Unified Text-Based Tool Calling
 *
 * Merged from the strong ai-os assistant:
 * - 17 tools: services, employees, attendance, advances, penalties,
 *   stock, rolls, consumptions, customers, suppliers, offers, invoices, payroll
 * - Text-based tool calling protocol: TOOL: <name>\nARGS: <json>
 * - User confirms before any write (pendingAction UI)
 * - Management memory (owner/GM/CEO)
 * - Anti-hallucination rules
 *
 * Preserves from v3:
 * - Compact data snapshot (≤3K tokens — fits OpenRouter credit)
 * - OpenRouter Llama 3.3 70B as primary provider
 * - Smart fallback when all providers fail
 */
import { db } from '@/lib/db'
import { categorizeService } from '@/lib/i18n'
import { AI_TOOLS, summarizeToolCall } from '@/lib/ai-tools'

// ─── Tool list (for system prompt) ────────────────────────────
const TOOL_NAMES = AI_TOOLS.map(t => t.function.name)
const TOOL_LIST_TEXT = AI_TOOLS.map(t =>
  `- ${t.function.name}(${Object.entries(t.function.parameters.properties).map(([k,v]:any)=>`${k}${t.function.parameters.required?.includes(k)?'*':''}:${v.type}`).join(', ')}) — ${t.function.description}`
).join('\n')

// ─── Tool: build comprehensive data snapshot ───────────────────
async function buildDataSnapshot() {
  const [
    rolls,
    employees,
    services,
    stockItems,
    invoices,
    advances,
    commissions,
    attendance,
    consumptions,
    alerts,
    penalties,
    stockMovements,
    serviceLogs,
    toolsMovements,
  ] = await Promise.all([
    db.roll.findMany({ include: { consumptions: { take: 10, orderBy: { date: 'desc' } } } }),
    db.employee.findMany({
      include: {
        advances: true,
        commissions: true,
        attendance: true,
        penalties: true,
      },
    }),
    db.service.findMany({ orderBy: { date: 'desc' }, take: 200 }),
    db.stockItem.findMany(),
    db.invoice.findMany(),
    db.advance.findMany(),
    db.commission.findMany(),
    db.attendance.findMany(),
    db.rollConsumption.findMany({ orderBy: { date: 'desc' }, take: 100 }),
    db.alert.findMany({ where: { isRead: false } }),
    db.penalty.findMany(),
    db.stockMovement.findMany({ orderBy: { date: 'desc' }, take: 50 }),
    db.serviceLog.findMany({ orderBy: { date: 'desc' }, take: 50 }),
    db.toolsMovement.findMany({ orderBy: { date: 'desc' }, take: 30 }),
  ])

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
  const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']

  // ─── Compute payroll per employee for current month ─────────
  const payroll = employees.map(emp => {
    const monthAtt = emp.attendance.filter(a => a.month === currentMonth && a.year === currentYear)
    const present = monthAtt.filter(a => a.status === 'حضور').length
    const absent = monthAtt.filter(a => a.status === 'غياب').length
    const officialLeave = monthAtt.filter(a => a.status === 'إجازة').length
    const weeklyLeave = monthAtt.filter(a => a.status === 'راحة').length

    const monthCommissions = emp.commissions.filter(c => c.month === currentMonth && c.year === currentYear)
    const totalCommissions = monthCommissions.reduce((s, c) => s + c.amount, 0)

    const monthAdvances = emp.advances.filter(a => a.month === currentMonth && a.year === currentYear)
    const totalAdvances = monthAdvances.reduce((s, a) => s + a.amount, 0)

    const monthPenalties = emp.penalties.filter(p => p.month === currentMonth && p.year === currentYear)
    const totalPenalties = monthPenalties.reduce((s, p) => s + p.amount, 0)

    const fixedSalary = emp.baseSalary
    const netSalary = fixedSalary + totalCommissions - totalAdvances - totalPenalties

    return {
      name: emp.name,
      jobTitle: emp.jobTitle,
      status: emp.status,
      fixedSalary,
      attendance: { present, absent, officialLeave, weeklyLeave, total: monthAtt.length },
      commissions: { count: monthCommissions.length, total: totalCommissions, items: monthCommissions.map(c => ({ client: c.clientName, car: c.carType, service: c.serviceType, amount: c.amount, date: c.date })) },
      advances: { count: monthAdvances.length, total: totalAdvances, items: monthAdvances.map(a => ({ amount: a.amount, date: a.date, notes: a.notes })) },
      penalties: { count: monthPenalties.length, total: totalPenalties, items: monthPenalties.map(p => ({ amount: p.amount, date: p.date, reason: p.reason })) },
      netSalary,
    }
  })

  // ─── Services analysis (regrouped) ─────────────────────────
  const servicesByCategory: Record<string, { count: number; total: number; items: any[] }> = {
    cat_polish: { count: 0, total: 0, items: [] },
    cat_nano: { count: 0, total: 0, items: [] },
    cat_detailing: { count: 0, total: 0, items: [] },
    cat_thermal: { count: 0, total: 0, items: [] },
    cat_protection: { count: 0, total: 0, items: [] },
    cat_other: { count: 0, total: 0, items: [] },
  }
  for (const s of services) {
    const cat = categorizeService(s.serviceType)
    servicesByCategory[cat].count++
    servicesByCategory[cat].total += s.price
    servicesByCategory[cat].items.push({
      code: s.code,
      date: s.date,
      client: s.clientName,
      car: s.carType,
      service: s.serviceType,
      price: s.price,
      technician: s.technician,
    })
  }

  // ─── Stock summary ─────────────────────────────────────────
  const stockByCategory = {
    detailing: stockItems.filter(s => s.category === 'detailing'),
    polish: stockItems.filter(s => s.category === 'polish'),
    nano: stockItems.filter(s => s.category === 'nano'),
    tools: stockItems.filter(s => s.category === 'tools'),
  }

  // ─── Rolls summary ─────────────────────────────────────────
  const rollsByCategory = {
    ppf: rolls.filter(r => r.rollCategory === 'ppf'),
    thermal_long: rolls.filter(r => r.rollCategory === 'thermal_long'),
    thermal_short: rolls.filter(r => r.rollCategory === 'thermal_short'),
  }

  // ─── OB summary (work orders) ──────────────────────────────
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
        rolls: [],
      }
    }
    obGroups[c.workOrder].totalMeters += c.metersUsed || 0
    obGroups[c.workOrder].rollsCount++
    obGroups[c.workOrder].rolls.push({
      rollCode: c.rollCode,
      metersUsed: c.metersUsed,
      waste: c.waste,
      usageArea: c.usageArea,
    })
  }
  const obList = Object.values(obGroups).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // Next OB number
  const obNumbers = obList.map((o: any) => o.workOrder).filter((w: string) => w && w.startsWith('OB-'))
  let nextOBNum = 1
  for (const w of obNumbers) {
    const m = w.match(/OB-(\d+)/)
    if (m) {
      const n = parseInt(m[1], 10)
      if (n >= nextOBNum) nextOBNum = n + 1
    }
  }
  const nextOB = `OB-${String(nextOBNum).padStart(4, '0')}`

  return {
    meta: {
      snapshotDate: now.toISOString(),
      currentMonth: monthNames[currentMonth - 1],
      currentMonthNum: currentMonth,
      currentYear,
    },
    // Compact payroll — names + net salary only (no detailed arrays)
    payroll: payroll.map(p => ({
      name: p.name, jobTitle: p.jobTitle, status: p.status,
      fixedSalary: p.fixedSalary, netSalary: p.netSalary,
      commissions: p.commissions.total, advances: p.advances.total, penalties: p.penalties.total,
      attendance: p.attendance,
    })),
    // Compact employees — names + role only
    employees: employees.map(e => ({ name: e.name, jobTitle: e.jobTitle, status: e.status })),
    // Compact rolls — code + remaining + status only (not full details)
    rolls: {
      summary: {
        total: rolls.length,
        active: rolls.filter(r => r.status === 'active').length,
        low: rolls.filter(r => r.status === 'low').length,
        finished: rolls.filter(r => r.status === 'finished').length,
        totalRemainingValue: rolls.reduce((s, r) => {
          const remaining = r.remainingLength || 0
          const total = r.totalLength || 1
          return s + ((r.price || 0) * (remaining / total))
        }, 0),
      },
      // Only list code + remaining length so AI can answer "رصيد رول XXX"
      items: rolls.map(r => ({
        code: r.code, brand: r.brand, type: r.type,
        category: r.rollCategory, remainingLength: r.remainingLength,
        totalLength: r.totalLength, status: r.status, price: r.price,
      })),
    },
    protection: {
      nextOB,
      recentOBs: obList.slice(0, 5).map((o: any) => ({
        workOrder: o.workOrder, clientName: o.clientName, carType: o.carType,
        totalMeters: o.totalMeters, rollsCount: o.rollsCount, date: o.date,
      })),
      totalConsumptions: consumptions.length,
    },
    // Compact services — category totals + last 10 only (not 200 items)
    services: {
      total: services.length,
      totalRevenue: services.reduce((s, x) => s + x.price, 0),
      byCategory: Object.entries(servicesByCategory).map(([key, v]) => ({
        key, count: v.count, total: v.total,
        average: v.count > 0 ? Math.round(v.total / v.count) : 0,
      })),
      recent: services.slice(0, 10).map(s => ({
        code: s.code, date: s.date, client: s.clientName, car: s.carType,
        service: s.serviceType, price: s.price, technician: s.technician,
      })),
    },
    // Compact stock — summary + low/out items only
    stock: {
      summary: {
        totalItems: stockItems.length,
        totalValue: stockItems.reduce((s, i) => s + (i.currentQty * i.unitPrice), 0),
        lowStock: stockItems.filter(s => s.status === 'منخفض').length,
        outOfStock: stockItems.filter(s => s.status === 'نفد').length,
      },
      lowItems: stockItems.filter(s => s.status !== 'كافي').map(i => ({
        name: i.name, unit: i.unit, currentQty: i.currentQty, status: i.status,
      })),
    },
    // Compact invoices — totals + last 5 only
    invoices: {
      total: invoices.length,
      totalNet: invoices.reduce((s, i) => s + i.net, 0),
      recent: invoices.slice(0, 5).map(i => ({
        deliveryNote: i.deliveryNote, date: i.date, net: i.net,
      })),
    },
    alerts: alerts.slice(0, 10).map(a => ({ type: a.type, title: a.title, message: a.message })),
    // Compact consumptions — last 10 only (not 100)
    consumptions: {
      total: consumptions.length,
      recent: consumptions.slice(0, 10).map(c => ({
        date: c.date, rollCode: c.rollCode, client: c.clientName,
        car: c.carType, metersUsed: c.metersUsed, workOrder: c.workOrder,
      })),
    },
  }
}

// ─── Protection command parser ────────────────────────────────
// Parses natural language commands related to PPF protection operations
interface ParsedProtectionCommand {
  isProtectionCommand: boolean
  action: 'register' | 'multi_roll' | 'next_ob' | 'search_roll' | 'query_ob' | null
  workOrder?: string
  clientName?: string
  carType?: string
  plateNumber?: string
  consumptions?: Array<{
    rollCode: string
    metersUsed: number
    waste?: number
    usageArea?: string
  }>
  partialCode?: string
  sameAsPrevious?: boolean
  response?: string  // pre-formatted response if no action needed
}

function parseProtectionCommand(message: string): ParsedProtectionCommand {
  const msg = message.trim()

  // Default: NOT a protection command — let the AI handle it.
  // The AI is smart enough to understand queries vs commands using the
  // data snapshot, and it asks for confirmation before executing.
  // This parser ONLY intercepts very explicit, unambiguous commands.
  const defaultRes: ParsedProtectionCommand = {
    isProtectionCommand: false,
    action: null,
  }

  // "نفس السابق" — same client, different roll (explicit phrase)
  if (/نفس\s*(السابق|اللي قبل|قبلي)/i.test(msg)) {
    return {
      isProtectionCommand: true,
      action: 'register',
      sameAsPrevious: true,
    }
  }

  // Multi-roll registration: EXPLICIT verb + "رولات" + number
  // e.g. "سجل 3 رولات" or "سجل 5 رولات على OB-0001"
  if (/(سجل|تسجيل|سجلي)\s*.*\d+\s*رولات/i.test(msg) || /(\d+)\s*رولات\s*على\s*OB/i.test(msg)) {
    return {
      isProtectionCommand: true,
      action: 'multi_roll',
    }
  }

  // Explicit registration: action verb + "استهلاك" + roll code + meters
  // e.g. "سجل استهلاك رول HXS-BF-001 بـ 2 متر" or "تسجيل استهلاك 3م من HXS-BF-001"
  const hasRegisterVerb = /(سجل|تسجيل|سجلي)\s*(استهلاك|سحب)?/i.test(msg)
  const hasConsumptionWord = /(استهلاك|اسحب|سحب)/i.test(msg)
  const rollCodeMatch = msg.match(/([A-Z]{2,5}[-]?\w{0,3}[-]?\d{1,4})/i)
  const metersMatch = msg.match(/(\d+\.?\d*)\s*م(?:تر|تر)?/)

  if ((hasRegisterVerb && hasConsumptionWord) && rollCodeMatch && metersMatch) {
    const obMatch = msg.match(/OB[-\s]*(\d+)/i)
    const workOrder = obMatch ? `OB-${obMatch[1].padStart(4, '0')}` : undefined
    return {
      isProtectionCommand: true,
      action: 'register',
      workOrder,
      consumptions: [{
        rollCode: rollCodeMatch[1].toUpperCase().replace(/_/g, '-'),
        metersUsed: parseFloat(metersMatch[1]),
      }],
    }
  }

  // Explicit OB query: "OB التالي" or "آخر OB" or "رقم OB الجديد"
  if (/(OB\s*(التالي|الجديد|القادم)|آخر\s*OB|ايه\s*OB|كم\s*OB|رقم\s*OB)/i.test(msg)) {
    return {
      isProtectionCommand: true,
      action: 'next_ob',
    }
  }

  // Explicit roll search: "دور على رول HXS" or "بحث عن رول 3M"
  if (/(دور|بحث|لقى|find|search|فين).*(رول|كود)\s*([A-Z0-9-]{2,15})/i.test(msg)) {
    const codeMatch = msg.match(/(?:رول|كود)\s*([A-Z0-9-]{2,15})/i)
    if (codeMatch) {
      return {
        isProtectionCommand: true,
        action: 'search_roll',
        partialCode: codeMatch[1].toUpperCase(),
      }
    }
  }

  // EVERYTHING ELSE (queries like "كم رصيد رول", greetings, explanations,
  // reports, etc.) → let the AI handle it with the full data snapshot.
  return defaultRes
}

// ─── Execute protection command via API ───────────────────────
async function executeProtectionCommand(cmd: ParsedProtectionCommand): Promise<string> {
  if (!cmd.action) return ''

  // Use relative URL — works on both Vercel and localhost
  // db is already imported at top of file, use direct db calls instead of HTTP fetch

  try {
    if (cmd.action === 'next_ob') {
      // Query DB directly
      const recentConsumptions = await db.rollConsumption.findMany({
        where: { workOrder: { startsWith: 'OB-' } },
        orderBy: { date: 'desc' },
        take: 30,
      })

      // Group by OB
      const obGroups: Record<string, any> = {}
      for (const c of recentConsumptions) {
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

      // Calculate next OB
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

      let response = `📋 **أمر الشغل التالي: ${nextOB}**\n\n`
      if (obList.length > 0) {
        response += `**آخر أوامر الشغل:**\n`
        for (const ob of obList.slice(0, 5)) {
          response += `• ${ob.workOrder} — ${ob.clientName || 'عميل'} — ${ob.carType || ''} — ${ob.totalMeters.toFixed(1)}م (${ob.rollsCount} رولات) — ${new Date(ob.date).toLocaleDateString('en-GB')}\n`
        }
      } else {
        response += `لا توجد أوامر شغل سابقة. ابدأ بـ ${nextOB}.`
      }
      return response
    }

    if (cmd.action === 'search_roll' && cmd.partialCode) {
      const partialUpper = cmd.partialCode.toUpperCase().trim()
      // Try exact match first
      const exact = await db.roll.findUnique({ where: { code: partialUpper } })
      let matches = exact ? [exact] : []
      if (matches.length === 0) {
        matches = await db.roll.findMany({
          where: {
            OR: [
              { code: { contains: partialUpper, mode: 'insensitive' } },
              { brand: { contains: cmd.partialCode, mode: 'insensitive' } },
              { type: { contains: cmd.partialCode, mode: 'insensitive' } },
            ],
          },
          take: 10,
        })
      }

      if (matches.length === 0) {
        return `❌ لم أجد أي رول يحتوي على "${cmd.partialCode}".`
      }
      let response = `🔍 **نتائج البحث عن "${cmd.partialCode}" (${matches.length} نتيجة):**\n\n`
      for (const r of matches) {
        const remaining = r.remainingLength || 0
        const status = remaining > 5 ? '✅ نشط' : remaining > 2 ? '⚠️ منخفض' : remaining > 0 ? '🚨 حرج' : '❌ منتهي'
        response += `• **${r.code}** — ${r.brand} ${r.type} ${r.model || ''} — متبقي ${remaining.toFixed(1)}م — ${status}\n`
      }
      return response
    }

    if (cmd.action === 'register' && cmd.consumptions && cmd.consumptions.length > 0) {
      const c = cmd.consumptions[0]
      // Fuzzy match the roll
      const partialUpper = c.rollCode.toUpperCase().trim()
      const exact = await db.roll.findUnique({ where: { code: partialUpper } })
      let rolls = exact ? [exact] : []
      if (rolls.length === 0) {
        rolls = await db.roll.findMany({
          where: {
            OR: [
              { code: { contains: partialUpper, mode: 'insensitive' } },
              { brand: { contains: c.rollCode, mode: 'insensitive' } },
              { type: { contains: c.rollCode, mode: 'insensitive' } },
            ],
          },
          take: 5,
        })
      }

      if (rolls.length === 0) {
        return `❌ لم أجد رول بكود "${c.rollCode}". اكتب: دور على رول ${c.rollCode} للبحث الجزئي.`
      }
      if (rolls.length > 1) {
        return `⚠️ يوجد ${rolls.length} رول مطابق لكود "${c.rollCode}":\n${rolls.map(r => `• ${r.code} — ${r.brand} ${r.type} (متبقي ${r.remainingLength?.toFixed(1)}م)`).join('\n')}\n\nحدد الكود الكامل.`
      }

      const roll = rolls[0]
      const metersUsed = Number(c.metersUsed) || 0
      const waste = Number(c.waste) || 0
      const totalUsed = metersUsed + waste

      if (totalUsed > (roll.remainingLength || 0)) {
        return `❌ الرصيد غير كافٍ في الرول ${roll.code}. المتبقي ${roll.remainingLength?.toFixed(2)}م، المطلوب ${totalUsed}م`
      }

      // Generate OB if not provided, or normalize if provided (Bo020 → OB-0020)
      let workOrder = cmd.workOrder
      if (!workOrder) {
        const allConsumptions = await db.rollConsumption.findMany({
          where: { workOrder: { startsWith: 'OB-' } },
        })
        const obNums = allConsumptions
          .map(x => x.workOrder?.match(/OB-(\d+)/)?.[1])
          .filter(Boolean)
          .map(x => parseInt(x!, 10))
        const maxNum = obNums.length > 0 ? Math.max(...obNums) : 0
        workOrder = `OB-${String(maxNum + 1).padStart(4, '0')}`
      } else {
        // Normalize OB format: Bo020, bo020, bo-020, OB0020 → OB-0020
        const obMatch = workOrder.match(/(?:OB|BO|bo|Bo)[-\s]*(\d+)/i)
        if (obMatch) {
          workOrder = `OB-${obMatch[1].padStart(4, '0')}`
        }
      }

      const consumption = await db.rollConsumption.create({
        data: {
          rollId: roll.id,
          rollCode: roll.code,
          date: new Date(),
          clientName: cmd.clientName || null,
          carType: cmd.carType || null,
          plateNumber: cmd.plateNumber || null,
          metersUsed,
          waste,
          usageArea: c.usageArea || null,
          workOrder,
          notes: null,
          technician: null,
          transactionType: 'استهلاك',
        },
      })

      const newRemaining = (roll.remainingLength || 0) - totalUsed
      let newStatus = 'active'
      if (newRemaining <= 0) newStatus = 'finished'
      else if (newRemaining <= 2) newStatus = 'low'

      const newCarsCount = cmd.clientName ? (roll.carsCount || 0) + 1 : roll.carsCount
      await db.roll.update({
        where: { id: roll.id },
        data: {
          remainingLength: newRemaining,
          status: newStatus,
          carsCount: newCarsCount,
        },
      })

      return `✅ تم تسجيل استهلاك ${metersUsed}م من الرول ${roll.code} بأمر الشغل ${workOrder}. المتبقي: ${newRemaining.toFixed(2)}م`
    }

    if (cmd.action === 'multi_roll') {
      return `📋 **تسجيل متعدد الرولات على نفس أمر الشغل (OB)**

للتسجيل، اكتب كل رول في سطر منفصل:
\`\`\`
سجل بـ OB-0020
العميل: محمد أحمد
السيارة: مرسيدس C200
HXS-BF-001 5م
3M-SG-002 3.5م
DNS-TPU-001 4م
\`\`\`

📌 **ملاحظة:** سيتم خصم الأمتار تلقائياً من كل رول وربطهم بنفس أمر الشغل (${cmd.workOrder || 'تلقائي'}).`
    }
  } catch (e: any) {
    return `❌ خطأ في تنفيذ الأمر: ${e.message}`
  }

  return ''
}

// ─── System prompt (Arabic, financial-grade accuracy) ─────────
const SYSTEM_PROMPT = `أنت "مساعد برستيج" — المساعد الذكي والمحاسبي لمركز Prestige Garage للعناية بالسيارات الفاخرة.

## ═══════════════════════════════════════════════════════════
## معلومات الإدارة الأساسية (ذاكرة دائمة — لا تنساها أبداً)
## ═══════════════════════════════════════════════════════════
- **رئيس مجلس إدارة برستيج والمالك**: المهندس علي الأمير زكريا
- **المدير العام**: مستر أحمد عبد السميع
- **مدير التشغيل (المدير التنفيذي)**: مستر أمير عمرو

عندما يُسأل عن المالك أو صاحب المركز أو رئيس مجلس الإدارة → الإجابة: المهندس علي الأمير زكريا.
عندما يُسأل عن المدير العام → الإجابة: مستر أحمد عبد السميع.
عندما يُسأل عن مدير التشغيل أو المدير التنفيذي → الإجابة: مستر أمير عمرو.

لا تخلط بينهم أبداً:
- المهندس علي الأمير زكريا هو المالك ورئيس مجلس الإدارة (مش مدير تنفيذي).
- مستر أحمد عبد السميع هو المدير العام.
- مستر أمير عمرو هو مدير التشغيل (المدير التنفيذي) — مش المالك.

## مهمتك:
أنت المساعد الذكي الشامل لمركز برستيج جراج — يديك صلاحية على **كل محتويات البرنامج**:
- 🎞️ **الرولات والبروتيكشن**: إضافة رول، استهلاك، هالك (OBX)، تعديل، بحث جزئي بالكود
- 👷 **الموظفون**: إضافة موظف، تسجيل حضور/غياب (فردي/جماعي)، سلف، جزاءات، عمولات، صرف مرتب
- 📦 **المخزون**: إضافة صنف، سحب/إضافة كمية، حذف، فواتير خامات
- 🔧 **الخدمات**: إضافة خدمة، حذف خدمة، استعلامات الإيرادات
- 🧑‍💼 **العملاء والموردون**: إضافة عميل/مورد
- 🏷️ **العروض**: إضافة عروض
- 💰 **الفواتير**: استعلامات
- 🔔 **التنبيهات**: عرض التنبيهات النشطة (رولات منخفضة، مخزون ناقص)
- 📊 **التقارير**: تقارير شهرية، مقارنات، إحصائيات

الإجابة على أسئلة المدير بدقة من البيانات، وتنفيذ عمليات التسجيل والحذف والتعديل عبر استدعاء الأدوات. أنت تملك كل القدرات — لا تقل أبداً "لا أملك القدرة".

## ═══════════════════════════════════════════════════════════
## قاعدة ذهبية (الأهم على الإطلاق):
## ═══════════════════════════════════════════════════════════
1. **نفّذ ما يطلبه المستخدم بالضبط — لا أكثر لا أقل.**
2. **أنت تملك كل القدرات** — تسجيل، تعديل، حذف، صرف. لا تقل أبداً "لا أملك القدرة".
3. **لا تضيف بيانات لم يطلبها المستخدم.**

## ═══════════════════════════════════════════════════════════
## قاعدة منع الهلوسة (إلزامية)
## ═══════════════════════════════════════════════════════════
1. **لا تخترع أي معلومات.** كل إجابة تستند إلى بيانات JSON المقدمة.
2. **إذا لم توجد معلومة** → قل: "لا توجد معلومات كافية".
3. **لا تخمن الأسماء أو الأرقام.**

## القواعد:
1. استخدم الأرقام الفعلية من البيانات فقط.
2. استخدم العربية الفصحى بلهجة مصرية، فواصل الآلاف، رمز ج.م.
3. المرتب الأساسي ثابت شهرياً. صافي المرتب = الثابت + العمولات - السلف - الجزاءات.

## بروتوكول استدعاء الأدوات (مهم جداً):
عندك أدوات حقيقية لتسجيل البيانات:

${TOOL_LIST_TEXT}

### متى تستخدم الأداة؟
- إذا طلب المستخدم **تسجيل/إضافة/حذف/تعديل/صرف** → استخدم الأداة المناسبة **فوراً**.
- إذا كان السؤال **استعلامياً** (كم؟ ما هو؟ أظهر؟) → أجب نصياً بدون أداة.
- **لا ترفض أي طلب تنفيذ** — إذا وُجدت أداة، استخدمها بلا تردد.

### كيف تستدعي الأداة؟ (صيغة إلزامية)
عندما تقرر استخدام أداة، أخرج **فقط** السطرين التاليين بدون أي نص إضافي:

TOOL: <اسم_الأداة>
ARGS: <json_صالح>

مثال:
TOOL: record_attendance
ARGS: {"employeeName":"أحمد السيد","date":"2026-07-05","status":"ح"}

### قواعد هامّة جداً:

#### أ. الهالك (Waste) — مهم:
- "سجل هالك X متر من رول YYY" = استدعِ roll_consumption بـ waste=X و metersUsed=0
- "سجل هالك على رول YYY" = استدعِ roll_consumption بـ waste=<القيمة> و metersUsed=0
- **لا تستخدم add_roll أبداً لتسجيل الهالك!** add_roll فقط لإضافة رول جديد للمخزون.
- الهالك = بواقي/قصاصات/هدر من رول موجود → يُخصم من رصيد الرول الحالي.
- مثال: "سجل هالك 1.5 متر من 3M-SG-004" →
  TOOL: roll_consumption
  ARGS: {"rollCode":"3M-SG-004","metersUsed":0,"waste":1.5}

#### أ.1 نظام ترقيم الهالك (OBX) — مهم جداً:
- الهالك ليهم نظام أرقام **منفصل**: OBX1, OBX2, OBX3... (مش OB-XXXX)
- OB-XXXX = استهلاك عادي (سيارة اتعملها خدمة)
- OBX-N = هالك فقط (بواقي/هدر بدون سيارة)
- النظام بيوفر OBX تلقائياً متسلسل لكل رول
- لو المستخدم قال "ابدأ من OBX5" → استخدم startWorkOrder="OBX5"
- **لا تخلط بين OB و OBX أبداً**

#### أ.2 تسجيل هالك لعدة رولات دفعة واحدة:
- "سجل هالك لكل الرولات أقل من 2 متر" → استدعِ batch_waste بقائمة items
- كل عنصر في items = { rollCode, waste }
- لو المستخدم طلب OB واحد للكل → استخدم workOrder (قيمة واحدة)
- لو المستخدم طلب "كل رول OB مستقل" أو "كل رول بعملية منفصلة" → استخدم startWorkOrder
  (كل رول ياخد OB متسلسل: الأول = startWorkOrder، التاني = اللي بعده، إلخ)
- مثال (OB واحد للكل): "سجل هالك لكل الرولات أقل من 2 متر بـ OB-0050"
  TOOL: batch_waste
  ARGS: {"items":[{"rollCode":"3M-SG-001","waste":1.5},{"rollCode":"3M-SG-005","waste":2}],"workOrder":"OB-0050"}
- مثال (OB مستقل لكل رول): "سجل هالك لكل رول بـ OB مستقل، ابدأ من OB-0050"
  TOOL: batch_waste
  ARGS: {"items":[{"rollCode":"3M-SG-001","waste":1.5},{"rollCode":"3M-SG-005","waste":2}],"startWorkOrder":"OB-0050"}
  → الرول الأول ياخد OB-0050، التاني OB-0051، إلخ
- استخدم batch_waste فقط عندما المستخدم يطلب عدة رولات مرة واحدة.

#### ب. الفرق بين add_roll و roll_consumption:
- **add_roll**: لما تيجيب رول جديد من المورد (لفة كاملة جديدة) → بتضيفه للمخزون.
- **roll_consumption**: لما تسحب/تستهلك/تهالك من رول موجود → بتخصم من رصيده.
- أي حاجة "هالك/بواقي/هدر/سحب/استهلاك" على رول موجود → roll_consumption فقط.

### قواعد التنفيذ:
1. استخدم اسم الموظف/كود الرول كما هو في بيانات JSON بالضبط.
2. التاريخ بصيغة YYYY-MM-DD. "اليوم" = meta.snapshotDate.
3. status للحضور: ح=حضور، غ=غياب، إ=إجازة رسمية، ر=إجازة أسبوعية.
4. لا تضف أي نص قبل أو بعد استدعاء الأداة — فقط السطرين.
5. النظام سيعرض ملخصاً وينتظر تأكيد المستخدم — لا تطلب التأكيد بنفسك.

## نظام البروتيكشن (PPF Rolls):
- "OB" = رقم أمر الشغل. كل عملية استهلاك لها OB.
- "نفس السابق" = نفس العميل والسيارة، بس رول آخر.
- عدة رولات على نفس OB → سجّل كل رول كعملية منفصلة بنفس OB.
- البحث الجزئي: لو كتب "HXS" بدل "HXS-BF-001" → ابحث في snapshot.

ستحصل على لقطة بيانات حديثة (JSON) — استخدمها بدقة.`

// ─── Multi-Provider Configuration ────────────────────────────
// LM 5 (Llama 5) - primary AI provider via OpenRouter
// Falls back to Groq (Llama 3.3 70B) and Z-AI GLM
const PROVIDERS = {
  // Primary provider: Gemini (Google AI Studio — free tier)
  gemini: {
    enabled: !!process.env.GEMINI_API_KEY,
    apiKey: process.env.GEMINI_API_KEY || '',
    model: 'gemini-flash-latest',
  },
  // Secondary: LM5 (OpenRouter — Llama 3.3 70B)
  lm5: {
    enabled: !!process.env.OPENROUTER_API_KEY,
    apiKey: process.env.OPENROUTER_API_KEY || '',
    model: process.env.LM5_MODEL || 'meta-llama/llama-3.3-70b-instruct',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    headers: {
      'HTTP-Referer': 'https://prestige-garage-internal.vercel.app',
      'X-Title': 'Prestige Garage AI-OS',
    },
  },
  // Groq fallback — Llama 3.3 70B (free, fast)
  groq: {
    enabled: !!process.env.GROQ_API_KEY,
    apiKey: process.env.GROQ_API_KEY || '',
    model: 'llama-3.3-70b-versatile',
    url: 'https://api.groq.com/openai/v1/chat/completions',
  },
  // OpenRouter alternative — Llama 3.1 8B (paid, always available)
  openrouter: {
    enabled: !!process.env.OPENROUTER_API_KEY,
    apiKey: process.env.OPENROUTER_API_KEY || '',
    model: 'meta-llama/llama-3.1-8b-instruct',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    headers: {
      'HTTP-Referer': 'https://prestige-garage-internal.vercel.app',
      'X-Title': 'Prestige Garage AI-OS',
    },
  },
}

async function callOpenAICompatible(url: string, apiKey: string, model: string, messages: any[], temperature: number, maxTokens: number, extraHeaders?: Record<string, string>): Promise<string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  }
  if (extraHeaders) {
    Object.assign(headers, extraHeaders)
  }
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
  })
  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw new Error(`API error ${response.status}: ${errText.slice(0, 200)}`)
  }
  const data = await response.json()
  return data.choices[0]?.message?.content || 'عذراً، لم أتمكن من توليد رد.'
}

// ─── Gemini caller (Google AI Studio) ────────────────────────
async function callGemini(messages: any[], temperature: number, maxTokens: number): Promise<string> {
  const systemInstruction = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n')
  const contents = messages.filter(m => m.role !== 'system').map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${PROVIDERS.gemini.model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': PROVIDERS.gemini.apiKey,
      },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: { temperature, maxOutputTokens: maxTokens },
      }),
    }
  )
  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw new Error(`Gemini API error ${response.status}: ${errText.slice(0, 200)}`)
  }
  const data = await response.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'عذراً، لم أتمكن من توليد رد.'
}

async function callZAI(messages: any[], temperature: number, maxTokens: number): Promise<string> {
  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const ai = await ZAI.create()
    const response = await ai.chat.completions.create({ messages, temperature, max_tokens: maxTokens })
    return response.choices[0]?.message?.content || 'عذراً، لم أتمكن من توليد رد.'
  } catch (e: any) {
    throw new Error(`Z-AI SDK: ${e.message}`)
  }
}

// ─── Smart fallback when no AI provider is available ────────
// Generates a helpful response based on the data snapshot + user question// ─── Text-based tool call parser (from v3 strong assistant) ───
// يستخرج TOOL name و ARGS json من النص. يتسامح مع JSON ناقص.
function repairJson(str: string): string {
  let s = str.trim().replace(/,\s*$/, '')
  let opens = 0, openBrackets = 0, inString = false, escape = false
  for (const ch of s) {
    if (escape) { escape = false; continue }
    if (ch === '\\') { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') opens++
    else if (ch === '}') opens--
    else if (ch === '[') openBrackets++
    else if (ch === ']') openBrackets--
  }
  while (openBrackets > 0) { s += ']'; openBrackets-- }
  while (opens > 0) { s += '}'; opens-- }
  return s
}

function tryParseJson(str: string): any | null {
  try { return JSON.parse(str) } catch {}
  try { return JSON.parse(repairJson(str)) } catch {}
  return null
}

function parseToolCall(text: string): { toolName: string; args: any } | null {
  if (!text) return null
  const cleaned = text.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim()
  // Pattern 1: TOOL: name \n ARGS: {json}
  const m1 = cleaned.match(/^TOOL:\s*([a-z_]+)\s*\n\s*ARGS:\s*(.+)$/is)
  if (m1) {
    const toolName = m1[1].toLowerCase().trim()
    if (TOOL_NAMES.includes(toolName)) {
      const parsed = tryParseJson(m1[2].trim())
      if (parsed) return { toolName, args: parsed }
    }
  }
  // Pattern 2: TOOL: name ARGS: {json} (same line)
  const m2 = cleaned.match(/^TOOL:\s*([a-z_]+)\s+ARGS:\s*(.+)$/is)
  if (m2) {
    const toolName = m2[1].toLowerCase().trim()
    if (TOOL_NAMES.includes(toolName)) {
      const parsed = tryParseJson(m2[2].trim())
      if (parsed) return { toolName, args: parsed }
    }
  }
  return null
}

function cleanReply(text: string): string {
  if (!text) return ''
  let out = text.replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660))
  out = out.replace(/[\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) - 0x06F0))
  out = out.replace(/[\u200E\u200F\u202A-\u202E]/g, '')
  out = out.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '')
  return out.trim()
}

// ─── Tool table map (for audit logging) ──────────────────────
const TOOL_TABLE_MAP: Record<string, string> = {
  create_service: 'services', add_employee: 'employees', record_attendance: 'attendance', batch_attendance: 'attendance',
  record_advance: 'advances', record_penalty: 'penalties', add_stock_item: 'stock_items',
  stock_movement: 'stock_movements', add_roll: 'rolls', roll_consumption: 'roll_consumptions',
  batch_waste: 'roll_consumptions',
  create_customer: 'customers', create_supplier: 'suppliers', create_offer: 'offers',
  create_stock_invoice: 'stock_invoices', delete_service: 'services', delete_stock_item: 'stock_items',
  pay_salary: 'payroll_payments',
}

// ─── Execute a confirmed tool call ───────────────────────────
export async function confirmAndExecuteTool(toolName: string, args: any, context?: { userId?: string; userName?: string }) {
  const { executeTool } = await import('@/lib/ai-tools')
  const { logAudit } = await import('@/lib/audit')
  const result = await executeTool(toolName, args, context)
  await db.aiConversation.create({ data: { userMessage: `[تأكيد] ${toolName}`, aiResponse: result.message, intentType: 'add', actionTaken: result.success ? toolName : `failed:${toolName}` } })
  if (result.success) {
    try {
      const isDelete = toolName.startsWith('delete_')
      await logAudit({
        action: isDelete ? 'delete' : 'create',
        tableName: TOOL_TABLE_MAP[toolName] || toolName,
        recordId: result.data?.id || result.data?.deletedCode || null,
        newValue: result.data,
        source: 'ai_assistant',
        userId: context?.userId || null,
        userName: context?.userName || null,
      })
    } catch (e) { /* audit logging is best-effort */ }
  }
  return result
}


async function smartFallback(userMessage: string, snapshot: any): Promise<string> {
  const msg = userMessage.toLowerCase()
  const lower = userMessage.trim()

  // Protection / OB queries
  if (/ob|أمر شغل|عملية|رقم العملية/i.test(lower)) {
    const nextOB = snapshot.protection?.nextOB || 'OB-0001'
    const recentOBs = snapshot.protection?.recentOBs || []
    let reply = `📋 **أمر الشغل التالي: ${nextOB}**\n\n`
    if (recentOBs.length > 0) {
      reply += `**آخر أوامر الشغل:**\n`
      for (const ob of recentOBs.slice(0, 5)) {
        reply += `• ${ob.workOrder} — ${ob.clientName || 'عميل'} — ${ob.carType || ''} — ${ob.totalMeters.toFixed(1)}م (${ob.rollsCount} رولات) — ${new Date(ob.date).toLocaleDateString('en-GB')}\n`
      }
    }
    return reply
  }

  // Rolls queries
  if (/رول|رولات|بروتيكشن|ppf/i.test(lower)) {
    const rolls = snapshot.rolls?.items || []
    let reply = `🎞️ **ملخص الرولات:**\n`
    reply += `• إجمالي الرولات: ${rolls.length}\n`
    reply += `• نشط: ${rolls.filter((r: any) => (r.remainingLength || 0) > 5).length}\n`
    reply += `• منخفض: ${rolls.filter((r: any) => { const rem = r.remainingLength || 0; return rem > 2 && rem <= 5; }).length}\n`
    reply += `• حرج: ${rolls.filter((r: any) => { const rem = r.remainingLength || 0; return rem > 0 && rem <= 2; }).length}\n`
    reply += `• منتهي: ${rolls.filter((r: any) => (r.remainingLength || 0) <= 0).length}\n\n`
    reply += `**الرولات النشطة (أول 5):**\n`
    for (const r of rolls.filter((r: any) => (r.remainingLength || 0) > 0).slice(0, 5)) {
      reply += `• ${r.code} — ${r.brand} ${r.type} — متبقي ${r.remainingLength?.toFixed(1)}م\n`
    }
    return reply
  }

  // Employees queries
  if (/موظف|موظفين|مرتب|عمولة|سلف|جزاء/i.test(lower)) {
    const employees = snapshot.employees || []
    const payroll = snapshot.payroll || []
    let reply = `👷 **ملخص الموظفين:**\n`
    reply += `• عدد الموظفين: ${employees.length}\n`
    reply += `• صافي الرواتب: ${payroll.reduce((s: number, e: any) => s + e.netSalary, 0).toLocaleString('en-US')} ج.م\n\n`
    for (const e of payroll.slice(0, 6)) {
      reply += `• **${e.name}** (${e.jobTitle || 'موظف'})\n`
      reply += `  - المرتب الثابت: ${e.fixedSalary.toLocaleString('en-US')} ج.م\n`
      reply += `  - العمولات: ${e.commissions.total.toLocaleString('en-US')} ج.م\n`
      reply += `  - السلفيات: ${e.advances.total.toLocaleString('en-US')} ج.م\n`
      reply += `  - صافي المرتب: ${e.netSalary.toLocaleString('en-US')} ج.م\n`
      reply += `  - حضور: ${e.attendance.present} | غياب: ${e.attendance.absent} | إجازة: ${e.attendance.officialLeave + e.attendance.weeklyLeave}\n`
    }
    return reply
  }

  // Stock queries
  if (/مخزون|خامات|بوليش|دتيلنج/i.test(lower)) {
    const stock = snapshot.stock || {}
    let reply = `📦 **ملخص المخزون:**\n`
    reply += `• إجمالي الأصناف: ${stock.summary?.totalItems || 0}\n`
    reply += `• قيمة المخزون: ${(stock.summary?.totalValue || 0).toLocaleString('en-US')} ج.م\n`
    reply += `• أصناف منخفضة: ${stock.summary?.lowStock || 0}\n`
    reply += `• أصناف نفدت: ${stock.summary?.outOfStock || 0}\n`
    return reply
  }

  // Services queries
  if (/خدمة|خدمات|إيراد|ايراد/i.test(lower)) {
    const services = snapshot.services || {}
    let reply = `🔧 **ملخص الخدمات:**\n`
    reply += `• إجمالي الخدمات: ${services.total || 0}\n`
    reply += `• إجمالي الإيرادات: ${(services.totalRevenue || 0).toLocaleString('en-US')} ج.م\n`
    return reply
  }

  // Default
  return `🤖 **المساعد الذكي - وضع بدون اتصال**

أهلاً! المساعد الذكي بيشتغل في الوضع "الذكي" بدون اتصال بـ AI خارجي.

**أنا أقدر أساعدك في:**
- 🎞️ **الرولات والبروتيكشن**: "ايه الـ OB التالي؟" أو "عرض الرولات"
- 👷 **الموظفين**: "عرض الموظفين" أو "المرتبات"
- 📦 **المخزون**: "المخزون" أو "الأصناف المنخفضة"
- 🔧 **الخدمات**: "الإيرادات" أو "الخدمات"
- 💰 **الفواتير**: "الفواتير"

**لكن للاستخدام الكامل للمساعد الذكي (محادثة حرة)، محتاج:**
1. **Groq API Key** (مجاني) - من https://console.groq.com
2. أو **OpenRouter API Key** (فيه نماذج مجانية) - من https://openrouter.ai

أضف المفتاح في متغيرات البيئة على Vercel:
- \`GROQ_API_KEY\` - لـ Groq (Llama 3.3 70B)
- \`OPENROUTER_API_KEY\` - لـ OpenRouter (LM 5 / Llama 5)

أو جرّب سؤال محدد من اللي فوق وأنا هجاوبك من البيانات المتاحة.`
}

// ─── Main: chat with assistant (Multi-Provider) ──────────────
export async function chatWithAssistant(userMessage: string, conversationHistory: { role: string; content: string }[] = []) {
  try {
    const snapshot = await buildDataSnapshot()

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'system', content: `بيانات المركز الحالية (JSON):\n${JSON.stringify(snapshot)}` },
      ...conversationHistory.slice(-6).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMessage },
    ]

    let rawReply = ''
    let providerUsed = ''
    const errors: string[] = []

    // Try 1: Gemini (Google AI Studio) — primary provider
    if (PROVIDERS.gemini.enabled) {
      try {
        rawReply = await callGemini(messages, 0.2, 800)
        providerUsed = 'gemini-flash'
      } catch (e: any) { errors.push(`Gemini: ${e.message}`) }
    }

    // Try 2: LM5 (OpenRouter Llama 3.3 70B) — secondary
    if (!rawReply && PROVIDERS.lm5.enabled) {
      try {
        rawReply = await callOpenAICompatible(
          PROVIDERS.lm5.url, PROVIDERS.lm5.apiKey, PROVIDERS.lm5.model,
          messages, 0.2, 800, PROVIDERS.lm5.headers,
        )
        providerUsed = 'openrouter-llama-3.3-70b'
      } catch (e: any) { errors.push(`OpenRouter: ${e.message}`) }
    }

    // Try 3: Groq (Llama 3.3 70B) — fast fallback
    if (!rawReply && PROVIDERS.groq.enabled) {
      try {
        rawReply = await callOpenAICompatible(PROVIDERS.groq.url, PROVIDERS.groq.apiKey, PROVIDERS.groq.model, messages, 0.2, 600)
        providerUsed = 'groq-llama-3.3-70b'
      } catch (e: any) { errors.push(`Groq: ${e.message}`) }
    }

    // Try 4: OpenRouter alternative (Llama 3.1 8B)
    if (!rawReply && PROVIDERS.openrouter.enabled) {
      try {
        rawReply = await callOpenAICompatible(
          PROVIDERS.openrouter.url, PROVIDERS.openrouter.apiKey, PROVIDERS.openrouter.model,
          messages, 0.2, 600, PROVIDERS.openrouter.headers,
        )
        providerUsed = 'openrouter-llama-3.1-8b'
      } catch (e: any) { errors.push(`OpenRouter: ${e.message}`) }
    }

    // Try 5: z-ai-web-dev-sdk (GLM)
    if (!rawReply) {
      try {
        rawReply = await callZAI(messages, 0.2, 600)
        providerUsed = 'z-ai-glm'
      } catch (e: any) { errors.push(`Z-AI: ${e.message}`) }
    }

    // Try 6: Smart fallback
    if (!rawReply) {
      rawReply = await smartFallback(userMessage, snapshot)
      providerUsed = 'smart-fallback'
    }

    if (!rawReply) {
      rawReply = `عذراً، حدث خطأ في جميع المزودين. ${errors.join(' | ')}`
      providerUsed = 'none'
    }

    // ─── Parse text-based tool call ────────────────────────────
    // لو المزود رجع استدعاء أداة، أنشئ ملخص عربي وانتظر تأكيد المستخدم
    const toolCall = parseToolCall(rawReply)
    if (toolCall) {
      const summary = summarizeToolCall(toolCall.toolName, toolCall.args)
      await db.aiConversation.create({
        data: { userMessage, aiResponse: summary, intentType: 'add', actionTaken: `pending:${toolCall.toolName}` },
      })
      return { reply: summary, intent: 'add', provider: providerUsed, pendingAction: { tool: toolCall.toolName, args: toolCall.args } }
    }

    const reply = cleanReply(rawReply)
    await db.aiConversation.create({
      data: { userMessage, aiResponse: reply, intentType: detectIntent(userMessage) },
    })
    return { reply, intent: detectIntent(userMessage), provider: providerUsed }
  } catch (e: any) {
    console.error('AI Assistant error:', e)
    return { reply: `عذراً، حدث خطأ. ${e.message || ''}`, intent: 'error', provider: 'none' }
  }
}

function detectIntent(message: string): string {
  if (/OB|أمر شغل|عملية|رولات|استهلاك|سجل\s*بـ/i.test(message)) return 'protection_action'
  if (/كم|ما هو|ما هي|أظهر|اعرض|قائمة|كشف|رصيد|متبقي|قيمة|حالة|صافي|مرتب/.test(message)) return 'query'
  if (/سجل|أضف|ضيف|ادخل|اشتريت|استلمت|خصم|جزاء/.test(message)) return 'add'
  if (/تقرير|قارن|تحليل|إحصائية|احصائية|كم ربح/.test(message)) return 'report'
  if (/نبه|تنبيه|تذكير/.test(message)) return 'alert'
  if (/اقترح|اقتراح|ماذا تنصح|ما رأيك/.test(message)) return 'suggestion'
  return 'query'
}
