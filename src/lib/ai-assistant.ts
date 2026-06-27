/**
 * Prestige AI Assistant Engine v2 — accurate data reading
 * Uses z-ai-web-dev-sdk with comprehensive database snapshot.
 * The AI has access to ALL data: rolls, employees, salaries, attendance,
 * advances, penalties, commissions, stock, services, invoices, alerts.
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
    db.rollConsumption.findMany(),
    db.alert.findMany({ where: { isRead: false } }),
    db.penalty.findMany(),
    db.stockMovement.findMany({ orderBy: { date: 'desc' }, take: 50 }),
  ])

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
  const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']

  // ─── Compute payroll per employee for current month ─────────
  // FIXED SALARY MODEL: salary is fixed monthly, only advances + penalties deducted
  const payroll = employees.map(emp => {
    const monthAtt = emp.attendance.filter(a => a.month === currentMonth && a.year === currentYear)
    const present = monthAtt.filter(a => a.status === 'ح').length
    const absent = monthAtt.filter(a => a.status === 'غ').length
    const officialLeave = monthAtt.filter(a => a.status === 'إ').length
    const weeklyLeave = monthAtt.filter(a => a.status === 'ر').length

    const monthCommissions = emp.commissions.filter(c => c.month === currentMonth && c.year === currentYear)
    const totalCommissions = monthCommissions.reduce((s, c) => s + c.amount, 0)

    const monthAdvances = emp.advances.filter(a => a.month === currentMonth && a.year === currentYear)
    const totalAdvances = monthAdvances.reduce((s, a) => s + a.amount, 0)

    const monthPenalties = emp.penalties.filter(p => p.month === currentMonth && p.year === currentYear)
    const totalPenalties = monthPenalties.reduce((s, p) => s + p.amount, 0)

    // FIXED SALARY — does NOT change with attendance
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

  return {
    meta: {
      snapshotDate: now.toISOString(),
      currentMonth: monthNames[currentMonth - 1],
      currentMonthNum: currentMonth,
      currentYear,
    },
    payroll, // ← FIXED SALARY model, full breakdown
    employees: employees.map(e => ({
      name: e.name,
      jobTitle: e.jobTitle,
      baseSalary: e.baseSalary,
      status: e.status,
      phone: e.phone,
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
      })),
    },
  }
}

// ─── System prompt (Arabic, financial-grade accuracy) ─────────
const SYSTEM_PROMPT = `أنت "مساعد برستيج" — المساعد الذكي والمحاسبي لمركز Prestige Garage للعناية بالسيارات الفاخرة.

## مهمتك الأساسية:
الإجابة على أسئلة المدير والفنيين بدقة متناهية من خلال البيانات المتاحة، حيث أن إجاباتك ستترتب عليها معاملات مالية هامة.

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

### 3. نطاق المعرفة
يمكنك الإجابة عن أي سؤال يتعلق بـ:
- **الرولات**: الرصيد، الاستهلاك، عدد السيارات، الموردين، الحالة، الفئة (PPF/عزل طويل/قصير)
- **الموظفون**: المرتب الثابت، الحضور، الغياب، العمولات، السلفيات، الجزاءات، صافي المرتب
- **المخزون**: الكميات، الوحدات (مل/عبوة/وحدة)، الحالة، الفئة (بوليش/دتيلنج/نانو/أدوات)
- **الخدمات**: السجل، الإيرادات، الفئات (بوليش/نانو/دتيلنج/عزل حراري وفاميه/بروتيكشن/أخرى)
- **الفواتير**: أذونات التسليم، المبالغ، الخصومات
- **التنبيهات**: الرولات المنخفضة، المخزون الناقص

### 4. قواعد المرتب (مهم جداً)
- المرتب الأساسي = مرتب ثابت شهري (لا يتأثر بالغياب)
- صافي المرتب = المرتب الثابت + العمولات - السلفيات - الجزاءات
- العمولات تُحسب من سجل الخدمات
- السلفيات تُخصم من المرتب
- الجزاءات تُخصم من المرتب
- الغياب لا يخفض المرتب الأساسي

### 5. الإجراءات
- إذا طلب المستخدم إضافة/تعديل بيانات، اطلب التأكيد واذكر البيانات التي ستسجلها
- إذا كان السؤال غامضاً، اطلب التوضيح بأدب
- قدم اقتراحات ذكية بناءً على البيانات (مثل: تنبيه لنقص مخزون، رول أوشك على النفاذ)

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
  if (/كم|ما هو|ما هي|أظهر|اعرض|قائمة|كشف|رصيد|متبقي|قيمة|حالة|صافي|مرتب/.test(message)) return 'query'
  if (/سجل|أضف|ضيف|ادخل|اشتريت|استلمت|خصم|جزاء/.test(message)) return 'add'
  if (/تقرير|قارن|تحليل|إحصائية|احصائية|كم ربح/.test(message)) return 'report'
  if (/نبه|تنبيه|تذكير/.test(message)) return 'alert'
  if (/اقترح|اقتراح|ماذا تنصح|ما رأيك/.test(message)) return 'suggestion'
  return 'query'
}
