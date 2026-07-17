/**
 * Prestige AI Assistant Engine v3 — Protection-aware with OB system
 *
 * Major additions:
 * - Understands OB (work order) commands
 * - "نفس السابق" = same client, different roll
 * - Multi-roll registration on same OB
 * - Fuzzy matching for roll codes (partial codes accepted)
 * - Auto-generates next OB sequence
 * - Can register consumptions directly via AI
 * - Connected to ALL database tables
 */
import { db } from '@/lib/db'
import { categorizeService } from '@/lib/i18n'

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
    payroll,
    employees: employees.map(e => ({
      name: e.name,
      jobTitle: e.jobTitle,
      baseSalary: e.baseSalary,
      status: e.status,
      phone: e.phone,
      serviceType: (e as any).serviceType,
      dashboardCategory: (e as any).dashboardCategory,
    })),
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
      byCategory: rollsByCategory,
      items: rolls.map(r => ({
        code: r.code,
        brand: r.brand,
        type: r.type,
        model: r.model,
        category: r.rollCategory,
        totalLength: r.totalLength,
        remainingLength: r.remainingLength,
        price: r.price,
        supplier: r.supplier,
        status: r.status,
        carsCount: r.carsCount,
        purchaseDate: r.purchaseDate,
      })),
    },
    protection: {
      nextOB,
      recentOBs: obList.slice(0, 10),
      totalConsumptions: consumptions.length,
      totalMetersUsed: consumptions.reduce((s, c) => s + (c.metersUsed || 0), 0),
    },
    services: {
      total: services.length,
      totalRevenue: services.reduce((s, x) => s + x.price, 0),
      byCategory: Object.entries(servicesByCategory).map(([key, v]) => ({
        key,
        count: v.count,
        total: v.total,
        average: v.count > 0 ? Math.round(v.total / v.count) : 0,
        sampleItems: v.items.slice(0, 5),
      })),
      recentItems: services.slice(0, 20).map(s => ({
        code: s.code,
        date: s.date,
        client: s.clientName,
        car: s.carType,
        service: s.serviceType,
        price: s.price,
        technician: s.technician,
      })),
    },
    stock: {
      summary: {
        totalItems: stockItems.length,
        totalValue: stockItems.reduce((s, i) => s + (i.currentQty * i.unitPrice), 0),
        lowStock: stockItems.filter(s => s.status === 'منخفض').length,
        outOfStock: stockItems.filter(s => s.status === 'نفد').length,
      },
      byCategory: Object.entries(stockByCategory).map(([cat, items]) => ({
        category: cat,
        count: items.length,
        items: items.map(i => ({
          name: i.name,
          unit: i.unit,
          currentQty: i.currentQty,
          minLevel: i.minLevel,
          status: i.status,
          unitPrice: i.unitPrice,
        })),
      })),
    },
    invoices: {
      total: invoices.length,
      totalNet: invoices.reduce((s, i) => s + i.net, 0),
      items: invoices.map(i => ({
        deliveryNote: i.deliveryNote,
        date: i.date,
        description: i.description,
        total: i.total,
        discount: i.discount,
        net: i.net,
        itemsCount: i.itemsCount,
      })),
    },
    alerts: alerts.map(a => ({
      type: a.type,
      severity: a.severity,
      title: a.title,
      message: a.message,
    })),
    consumptions: {
      total: consumptions.length,
      recent: consumptions.slice(0, 20).map(c => ({
        date: c.date,
        rollCode: c.rollCode,
        client: c.clientName,
        car: c.carType,
        metersUsed: c.metersUsed,
        waste: c.waste,
        workOrder: c.workOrder,
        usageArea: c.usageArea,
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

## مهمتك الأساسية:
الإجابة على أسئلة المدير والفنيين بدقة متناهية من خلال البيانات المتاحة، حيث أن إجاباتك ستترتب عليها معاملات مالية هامة. كما يمكنك تنفيذ أوامر البروتيكشن (PPF) مباشرة.

## القواعد الإلزامية:

### 1. الدقة أولاً
- اقرأ البيانات المقدمة بعناية شديدة قبل الإجابة
- استخدم الأرقام الفعلية من البيانات فقط — لا تخمن ولا تتوقع
- إذا كانت البيانات غير كافية للإجابة، قل صراحة "لا توجد بيانات كافية"
- لا تستخدم تقريب إلا إذا طُلب منك

### 2. تنسيق الإجابات
- استخدم العربية الفصحى بلهجة مصرية بسيطة
- اعرف العملة (ج.م أو EGP) لكل مبلغ
- استخدم الرموز التعبيرية المناسبة: 🎞️ 👷 📦 🔧 💰 ⚠️ ✅ 📊
- للأرقام الكبيرة استخدم فواصل الآلاف (15,000 وليس 15000)
- نظّم الإجابات الطويلة في نقاط واضحة

### 3. نطاق المعرفة — متصل بكل الجداول
يمكنك الإجابة عن أي سؤال يتعلق بـ:
- **الرولات والبروتيكشن**: الرصيد، الاستهلاك، عدد السيارات، الموردين، الحالة، الفئة (PPF/عزل طويل/قصير)
- **أوامر الشغل (OB)**: التالي، السجل، الربط بين الرولات والعملاء
- **الموظفون**: المرتب الثابت، الحضور، الغياب، العمولات، السلفيات، الجزاءات، صافي المرتب
- **المخزون**: الكميات، الوحدات، الحالة، الفئة (بوليش/دتيلنج/نانو/أدوات)
- **الخدمات**: السجل، الإيرادات، الفئات (بوليش/نانو/دتيلنج/عزل حراري/بروتيكشن/أخرى)
- **الفواتير**: أذونات التسليم، المبالغ، الخصومات
- **التنبيهات**: الرولات المنخفضة، المخزون الناقص

### 4. أوامر البروتيكشن (PPF) — مهم جداً
يمكنك تنفيذ أوامر البروتيكشن مباشرة:

#### أ. رقم أمر الشغل (OB)
- عندما يقول المستخدم "OB" أو "أمر الشغل" أو "رقم العملية"
- استخرج رقم OB إن وجد، أو اقترح الرقم التالي تلقائياً
- اعرض آخر 5 أوامر شغل للسياق

#### ب. "نفس السابق"
- عندما يقول المستخدم "نفس السابق" = نفس العميل، لكن سحب من رول آخر
- احتفظ باسم العميل ونوع السيارة من آخر تسجيل
- اطلب فقط الرول الجديد والأمتار

#### ج. رولات متعددة على نفس OB
- عندما يقول "رولات" + رقم (مثل "5 رولات" أو "3 رولات على OB-0020")
- يمكن تسجيل عدة رولات على نفس أمر الشغل لنفس العميل
- كل رول يُسجل بسحبه الخاص، لكنهم يرتبطون بنفس OB

#### د. البحث الجزئي عن الرول
- يقبل المستخدم كتابة جزء من الكود (مثل "HXS" بدلاً من "HXS-BF-001")
- ابحث عن كل الرولات المطابقة واعرضها
- إذا كان هناك تطابق واحد فقط، سجل مباشرة
- إذا كان هناك عدة تطابقات، اطلب التحديد

#### هـ. التسلسل التلقائي
- عند بدء OB جديد، خذ التسلسل التالي تلقائياً (OB-0020، OB-0021، ...)
- لا تطلب من المستخدم تذكر الرقم

### 5. قواعد المرتب (مهم جداً)
- المرتب الأساسي = مرتب ثابت شهري (لا يتأثر بالغياب)
- صافي المرتب = المرتب الثابت + العمولات - السلفيات - الجزاءات
- العمولات تُحسب من سجل الخدمات
- السلفيات تُخصم من المرتب
- الجزاءات تُخصم من المرتب
- الغياب لا يخفض المرتب الأساسي

### 6. الإجراءات
- إذا طلب المستخدم إضافة/تعديل بيانات، اطلب التأكيد واذكر البيانات التي ستسجلها
- إذا كان السؤال غامضاً، اطلب التوضيح بأدب
- قدم اقتراحات ذكية بناءً على البيانات (مثل: تنبيه لنقص مخزون، رول أوشك على النفاذ)
- عند تسجيل استهلاك، اذكر: الرول، الأمتار، OB، الرصيد المتبقي

ستحصل على لقطة بيانات حديثة (JSON) — استخدمها بدقة للإجابة.`

// ─── Multi-Provider Configuration ────────────────────────────
// LM 5 (Llama 5) - primary AI provider via OpenRouter
// Falls back to Groq (Llama 3.3 70B) and Z-AI GLM
const PROVIDERS = {
  // Primary provider via OpenRouter — Llama 3.3 70B Instruct
  // (Llama 5 not yet available on OpenRouter; using the best available model)
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
// Generates a helpful response based on the data snapshot + user question
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

    // ─── Check if this is a protection command first ─────────
    const protectionCmd = parseProtectionCommand(userMessage)
    if (protectionCmd.isProtectionCommand) {
      // Try to execute the protection command directly
      const protectionResponse = await executeProtectionCommand(protectionCmd)
      if (protectionResponse) {
        await db.aiConversation.create({
          data: {
            userMessage,
            aiResponse: protectionResponse,
            intentType: 'protection_action',
          },
        })
        return { reply: protectionResponse, intent: 'protection_action', provider: 'direct' }
      }
    }

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'system', content: `بيانات المركز الحالية (JSON مفصل):\n${JSON.stringify(snapshot, null, 2)}` },
      ...conversationHistory.slice(-6).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMessage },
    ]

    let reply = ''
    let providerUsed = ''
    const errors: string[] = []

    // Try 1: LM 5 (Llama 5) via OpenRouter — primary provider
    if (PROVIDERS.lm5.enabled) {
      try {
        reply = await callOpenAICompatible(
          PROVIDERS.lm5.url,
          PROVIDERS.lm5.apiKey,
          PROVIDERS.lm5.model,
          messages,
          0.2,
          1500,
          PROVIDERS.lm5.headers,
        )
        providerUsed = 'lm5-llama-5'
      } catch (e: any) { errors.push(`LM5: ${e.message}`) }
    }

    // Try 2: Groq (Llama 3.3 70B) — fast fallback
    if (!reply && PROVIDERS.groq.enabled) {
      try {
        reply = await callOpenAICompatible(PROVIDERS.groq.url, PROVIDERS.groq.apiKey, PROVIDERS.groq.model, messages, 0.2, 1200)
        providerUsed = 'groq-llama-3.3-70b'
      } catch (e: any) { errors.push(`Groq: ${e.message}`) }
    }

    // Try 3: OpenRouter (Llama 3.1 8B free)
    if (!reply && PROVIDERS.openrouter.enabled) {
      try {
        reply = await callOpenAICompatible(
          PROVIDERS.openrouter.url,
          PROVIDERS.openrouter.apiKey,
          PROVIDERS.openrouter.model,
          messages,
          0.2,
          1200,
          PROVIDERS.openrouter.headers,
        )
        providerUsed = 'openrouter-llama-3.1-8b'
      } catch (e: any) { errors.push(`OpenRouter: ${e.message}`) }
    }

    // Try 4: z-ai-web-dev-sdk (GLM) — always available
    if (!reply) {
      try {
        reply = await callZAI(messages, 0.2, 1200)
        providerUsed = 'z-ai-glm'
      } catch (e: any) { errors.push(`Z-AI: ${e.message}`) }
    }

    // Try 5: Smart fallback — generates helpful response from database
    if (!reply) {
      reply = await smartFallback(userMessage, snapshot)
      providerUsed = 'smart-fallback'
    }

    if (!reply) {
      reply = `عذراً، حدث خطأ في جميع مزودي الذكاء الاصطناعي. ${errors.join(' | ')}`
      providerUsed = 'none'
    }

    await db.aiConversation.create({
      data: { userMessage, aiResponse: reply, intentType: detectIntent(userMessage) },
    })

    return { reply, intent: detectIntent(userMessage), provider: providerUsed, errors }
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
