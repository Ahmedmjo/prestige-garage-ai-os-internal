/**
 * Stock Operations Helpers — منطق مشترك للمخزون
 * ═══════════════════════════════════════════════════════════════
 * يُستخدم من: API routes + AI tools layer (مصدر واحد للحقيقة)
 */
import { db } from '@/lib/db'

// ─── تطبيع اسم الخامة (Normalization) ─────────────────────────
// يوحّد المسافات + يحوّل لـ lowercase + يزيل التشكيل العربي
// هذا يلتقط 80% من حالات التكرار (Sonax Active Foam vs sonax active foam)
export function normalizeStockName(name: string): string {
  return (name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')           // توحيد المسافات المتعددة
    .replace(/[\u064B-\u0652]/g, '') // إزالة التشكيل العربي
    .replace(/[ًٌٍَُِّْ]/g, '')       // إزالة الحركات
}

// ─── مولّد أكواد الخامات ─────────────────────────────────────
// صيغة: STL-001 (polish), STD-001 (detailing), STN-001 (nano), STT-001 (tools)
const STOCK_PREFIXES: Record<string, string> = {
  polish: 'STL',
  detailing: 'STD',
  nano: 'STN',
  tools: 'STT',
}

export function getStockPrefix(category: string): string {
  return STOCK_PREFIXES[category] || 'STT' // افتراضي: أدوات
}

/**
 * يولّد كود خامة جديد بصيغة PREFIX-NNN
 * يبحث عن آخر رقم مستخدم لنفس البادئة ويزيد عليه.
 */
export async function generateStockCode(category: string): Promise<string> {
  const prefix = getStockPrefix(category)
  const items = await db.stockItem.findMany({
    where: { code: { startsWith: prefix + '-' } },
    select: { code: true },
  })

  let maxNum = 0
  for (const item of items) {
    const match = item.code?.match(new RegExp(`^${prefix}-(\\d+)$`))
    if (match) {
      const num = parseInt(match[1], 10)
      if (num > maxNum) maxNum = num
    }
  }

  const nextNum = maxNum + 1
  return `${prefix}-${String(nextNum).padStart(3, '0')}`
}

// ─── حساب حالة المخزون ───────────────────────────────────────
export function recalcStockStatus(currentQty: number, minLevel: number): string {
  if (currentQty <= 0) return 'نفد'
  if (currentQty < minLevel) return 'منخفض'
  return 'كافي'
}

// ─── إدارة التنبيهات (المنطق الكامل: إنشاء + حذف عكسي) ──────
/**
 * يدير تنبيهات المخزون بعد حركة:
 * - إن انتقل من "كافي" → "منخفض/نفد": ينشئ تنبيهاً.
 * - إن انتقل من "منخفض/نفد" → "كافي": يحذف التنبيه القديم (لأنه لم يعد له معنى).
 *
 * @param itemId - معرّف الصنف
 * @param itemName - اسم الصنف (للرسالة)
 * @param category - فئة الصنف
 * @param unit - وحدة القياس
 * @param oldStatus - الحالة قبل الحركة
 * @param newStatus - الحالة بعد الحركة
 * @param newQty - الكمية الجديدة
 */
export async function manageStockAlerts(params: {
  itemId: string
  itemName: string
  category: string
  unit: string
  oldStatus: string
  newStatus: string
  newQty: number
}): Promise<void> {
  const { itemId, itemName, category, unit, oldStatus, newStatus, newQty } = params

  // الحالة 1: انتقل من "كافي" → "منخفض/نفد" → أنشئ تنبيهاً
  if (newStatus !== 'كافي' && oldStatus === 'كافي') {
    await db.alert.create({
      data: {
        type: 'low_stock',
        severity: newStatus === 'نفد' ? 'critical' : 'warning',
        title: `مخزون ${itemName} ${newStatus === 'نفد' ? 'نفد' : 'منخفض'}`,
        message: `الصنف ${itemName} (${category}) — الكمية الحالية ${newQty} ${unit}`,
        relatedId: itemId,
        relatedType: 'stock_item',
      },
    })
  }

  // الحالة 2: انتقل من "منخفض/نفد" → "كافي" → احذف التنبيه القديم
  // (التنبيه لم يعد له معنى بعد عودة الكمية لكافٍ)
  if (newStatus === 'كافي' && oldStatus !== 'كافي') {
    await db.alert.deleteMany({
      where: {
        type: 'low_stock',
        relatedType: 'stock_item',
        relatedId: itemId,
        isRead: false,
      },
    })
  }
}

// ─── البحث عن خامة (بالكود أو الاسم المطبّع) ─────────────────
/**
 * يبحث عن خامة:
 * 1. بالكود (إن وُجد) — الأسرع والأأمن.
 * 2. بالاسم المطبّع (normalize) — يلتقط اختلافات الـ case والمسافات.
 * 3. يحتوي الاسم (fuzzy خفيف) — كحل أخير.
 *
 * @returns العنصر إن وُجد، null وإلا.
 */
export async function findStockItem(itemCode?: string, itemName?: string): Promise<{ id: string; name: string; code: string | null; category: string; unit: string; currentQty: number; minLevel: number; totalReceived: number; totalWithdrawn: number; unitPrice: number; status: string } | null> {
  // 1. بالكود
  if (itemCode) {
    const item = await db.stockItem.findUnique({ where: { code: itemCode } })
    if (item) return item as any
  }

  // 2. بالاسم المطبّع (ابحث عن كل الأصناف ثم طابِق المطبّع)
  if (itemName) {
    const normalized = normalizeStockName(itemName)
    const allItems = await db.stockItem.findMany()
    const match = allItems.find(i => normalizeStockName(i.name) === normalized)
    if (match) return match as any

    // 3. fuzzy خفيف: يحتوي الاسم المطبّع (كحل أخير — إن وجد تطابقاً واحداً فقط)
    const containsMatches = allItems.filter(i => {
      const n = normalizeStockName(i.name)
      return n.includes(normalized) || normalized.includes(n)
    })
    if (containsMatches.length === 1) return containsMatches[0] as any
  }

  return null
}
