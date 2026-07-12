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
  const lower = msg.toLowerCase()

  // Default response
  const defaultRes: ParsedProtectionCommand = {
    isProtectionCommand: false,
    action: null,
  }

  // Check for OB-related commands
  const hasOB = /\bOB\b|أمر شغل|أمر الشغل|عملية|تسجيل بـ?\s*OB/i.test(msg)

  // "نفس السابق" — same client, different roll
  if (/نفس\s*(السابق|اللي قبل|قبلي)/i.test(msg)) {
    return {
      isProtectionCommand: true,
      action: 'register',
      sameAsPrevious: true,
    }
  }

  // Multi-roll registration: "رولات" + numbers
  // e.g. "رولات 5" or "سجل 3 رولات" or "5 رولات على OB-0001"
  const multiRollMatch = msg.match(/(\d+)\s*رولات|رولات\s*(\d+)|(\d+)\s*رول\s*على/i)
  if (multiRollMatch || (/رولات/i.test(msg) && hasOB)) {
    return {
      isProtectionCommand: true,
      action: 'multi_roll',
    }
  }

  // "سجل بـ OB" or "تسجيل OB-XXXX"
  if (/(سجل|تسجيل|سجلي|سجل\s*بـ?|اشرح|حط|ضيف)\s*(بـ?\s*)?OB/i.test(msg) || hasOB) {
    // Try to extract OB number
    const obMatch = msg.match(/OB[-\s]*(\d+)/i)
    const workOrder = obMatch ? `OB-${obMatch[1].padStart(4, '0')}` : undefined

    // Try to extract roll code and meters
    const rollCodeMatch = msg.match(/([A-Z]{2,5}[-_]?\w{0,3}[-_]?\d{1,4})/i)
    const metersMatch = msg.match(/(\d+\.?\d*)\s*م/)

    if (rollCodeMatch && metersMatch) {
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

    return {
      isProtectionCommand: true,
      action: 'next_ob',
    }
  }

  // Query for OB info
  if (/(كم\s*OB|آخر\s*OB|ايه\s*OB|شنو\s*OB|OB\s*التالي|OB\s*الجديد|ايه\s*رقم|رقم\s*العملية|رقم\s*أمر\s*الشغل)/i.test(msg)) {
    return {
      isProtectionCommand: true,
      action: 'next_ob',
    }
  }

  // Search for roll by partial code
  // e.g. "دور على رول HXS" or "بحث عن 3M"
  if (/(دور|بحث|لقى|find|search|فين|في\s*ايه).*(رول|كود)\s*([A-Z0-9-]{2,15})/i.test(msg)) {
    const codeMatch = msg.match(/(?:رول|كود)\s*([A-Z0-9-]{2,15})/i)
    if (codeMatch) {
      return {
        isProtectionCommand: true,
        action: 'search_roll',
        partialCode: codeMatch[1].toUpperCase(),
      }
    }
  }

  return defaultRes
}

// ─── Execute protection command via API ───────────────────────
async function executeProtectionCommand(cmd: ParsedProtectionCommand): Promise<string> {
  if (!cmd.action) return ''

  const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'

  try {
    if (cmd.action === 'next_ob') {
      const res = await fetch(`${baseUrl}/api/ai/protection-action`, { method: 'GET' })
      const data = await res.json()
      let response = `📋 **أمر الشغل التالي: ${data.nextOB}**\n\n`
      if (data.recentOBs && data.recentOBs.length > 0) {
        response += `**آخر أوامر الشغل:**\n`
        for (const ob of data.recentOBs.slice(0, 5)) {
          response += `• ${ob.workOrder} — ${ob.clientName || 'عميل'} — ${ob.carType || ''} — ${ob.totalMeters.toFixed(1)}م (${ob.rollsCount} رولات) — ${new Date(ob.date).toLocaleDateString('en-GB')}\n`
        }
      } else {
        response += `لا توجد أوامر شغل سابقة. ابدأ بـ ${data.nextOB}.`
      }
      return response
    }

    if (cmd.action === 'search_roll' && cmd.partialCode) {
      const res = await fetch(`${baseUrl}/api/ai/protection-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'fuzzy_search_roll',
          partialCode: cmd.partialCode,
        }),
      })
      const data = await res.json()
      if (data.count === 0) {
        return `❌ لم أجد أي رول يحتوي على "${cmd.partialCode}".`
      }
      let response = `🔍 **نتائج البحث عن "${cmd.partialCode}" (${data.count} نتيجة):**\n\n`
      for (const r of data.matches) {
        const status = r.status === 'active' ? '✅ نشط' : r.status === 'low' ? '⚠️ منخفض' : '❌ منتهي'
        response += `• **${r.code}** — ${r.brand} ${r.type} ${r.model || ''} — متبقي ${r.remainingLength?.toFixed(1)}م — ${status}\n`
      }
      return response
    }

    if (cmd.action === 'register' && cmd.consumptions && cmd.consumptions.length > 0) {
      const c = cmd.consumptions[0]
      const res = await fetch(`${baseUrl}/api/ai/protection-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register_consumption',
          rollCode: c.rollCode,
          metersUsed: c.metersUsed,
          waste: c.waste,
          usageArea: c.usageArea,
          workOrder: cmd.workOrder,
          clientName: cmd.clientName,
          carType: cmd.carType,
          plateNumber: cmd.plateNumber,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.suggestions && data.suggestions.length > 0) {
          return `⚠️ يوجد ${data.suggestions.length} رول مطابق لكود "${c.rollCode}":\n${data.suggestions.map((s: string) => `• ${s}`).join('\n')}\n\nحدد الكود الكامل.`
        }
        return `❌ ${data.error}`
      }
      return data.message
    }

    if (cmd.action === 'multi_roll') {
      // For multi-roll, we need the user to provide the rolls and meters
      // The AI will guide them through it
      return `📋 **تسجيل متعدد الرولات على نفس أمر الشغل (OB)**

للتسجيل، اكتب:
\`\`\`
رولات: HXS-BF-001 5م, 3M-SG-002 3.5م, DNS-TPU-001 4م
العميل: محمد أحمد
السيارة: مرسيدس C200
OB: OB-0020 (أو اكتب "تلقائي")
\`\`\`

أو بصيغة مبسطة:
\`\`\`
سجل بـ OB-0020
العميل: محمد
الرولات:
HXS-BF-001 = 5م
3M-SG-002 = 3.5م
\`\`\`

📌 **ملاحظة:** كل سطر = رول واحد. سيتم خصم الأمتار تلقائياً من كل رول وربطهم بنفس أمر الشغل.`
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
const PROVIDERS = {
  groq: {
    enabled: !!process.env.GROQ_API_KEY,
    apiKey: process.env.GROQ_API_KEY || '',
    model: 'llama-3.3-70b-versatile',
    url: 'https://api.groq.com/openai/v1/chat/completions',
  },
  openrouter: {
    enabled: !!process.env.OPENROUTER_API_KEY,
    apiKey: process.env.OPENROUTER_API_KEY || '',
    model: 'meta-llama/llama-3.1-8b-instruct:free',
    url: 'https://openrouter.ai/api/v1/chat/completions',
  },
}

async function callOpenAICompatible(url: string, apiKey: string, model: string, messages: any[], temperature: number, maxTokens: number): Promise<string> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
  })
  if (!response.ok) throw new Error(`API error ${response.status}`)
  const data = await response.json()
  return data.choices[0]?.message?.content || 'عذراً، لم أتمكن من توليد رد.'
}

async function callZAI(messages: any[], temperature: number, maxTokens: number): Promise<string> {
  const ZAI = (await import('z-ai-web-dev-sdk')).default
  const ai = await ZAI.create()
  const response = await ai.chat.completions.create({ messages, temperature, max_tokens: maxTokens })
  return response.choices[0]?.message?.content || 'عذراً، لم أتمكن من توليد رد.'
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

    // Try 1: Groq (Llama 3 70B)
    if (PROVIDERS.groq.enabled) {
      try {
        reply = await callOpenAICompatible(PROVIDERS.groq.url, PROVIDERS.groq.apiKey, PROVIDERS.groq.model, messages, 0.2, 1200)
        providerUsed = 'groq-llama-3.3-70b'
      } catch (e: any) { errors.push(`Groq: ${e.message}`) }
    }

    // Try 2: OpenRouter (Llama 3 8B)
    if (!reply && PROVIDERS.openrouter.enabled) {
      try {
        reply = await callOpenAICompatible(PROVIDERS.openrouter.url, PROVIDERS.openrouter.apiKey, PROVIDERS.openrouter.model, messages, 0.2, 1200)
        providerUsed = 'openrouter-llama-3.1-8b'
      } catch (e: any) { errors.push(`OpenRouter: ${e.message}`) }
    }

    // Try 3: z-ai-web-dev-sdk (GLM) — always available
    if (!reply) {
      try {
        reply = await callZAI(messages, 0.2, 1200)
        providerUsed = 'z-ai-glm'
      } catch (e: any) { errors.push(`Z-AI: ${e.message}`) }
    }

    if (!reply) {
      reply = `عذراً، حدث خطأ في جميع مزودي الذكاء الاصطناعي. ${errors.join(' | ')}`
      providerUsed = 'none'
    }

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
