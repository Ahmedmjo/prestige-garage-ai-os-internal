import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/settings/alerts — get alert thresholds
// Default thresholds based on the protection Excel file analysis:
// - Roll remaining < 2m = LOW (yellow)
// - Roll remaining < 5m = WARNING (orange)
// - Roll remaining <= 0 = FINISHED (red)
// - Stock item currentQty < minLevel = LOW (yellow)
// - Stock item currentQty = 0 = OUT (red)
export async function GET() {
  try {
    // Try to read from Setting table (key/value store)
    const settings = await db.setting.findMany({
      where: {
        key: {
          contains: 'alert_',
        },
      },
    })

    const defaults = {
      roll_low_threshold: 5,       // أمتار - يحول لأصفر
      roll_critical_threshold: 2,  // أمتار - يحول لأحمر
      roll_finished_threshold: 0,  // أمتار - يحول لأسود/منتهي
      stock_low_multiplier: 1.0,   // ضرب minLevel - يحول لأصفر
      stock_out_threshold: 0,      // كمية - يحول لأحمر
      consumption_waste_alert: 1,  // متر هالك - تنبيه
      daily_attendance_alert: 5,   // عدد أيام الغياب المتتالية
      monthly_advance_limit: 3000, // حد السلف الشهرية
    }

    // Merge with DB values
    const result: any = { ...defaults }
    for (const s of settings) {
      const key = s.key.replace('alert_', '')
      const numVal = parseFloat(s.value)
      if (!isNaN(numVal)) {
        result[key] = numVal
      } else {
        result[key] = s.value
      }
    }

    return NextResponse.json({
      thresholds: result,
      source: settings.length > 0 ? 'database' : 'defaults',
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PUT /api/settings/alerts — update alert thresholds
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const updates = body.thresholds || body

    const results: any[] = []
    for (const [key, value] of Object.entries(updates)) {
      const settingKey = `alert_${key}`
      const valStr = String(value)
      const existing = await db.setting.findFirst({ where: { key: settingKey } })
      if (existing) {
        const updated = await db.setting.update({
          where: { id: existing.id },
          data: { value: valStr },
        })
        results.push(updated)
      } else {
        const created = await db.setting.create({
          data: { key: settingKey, value: valStr },
        })
        results.push(created)
      }
    }

    return NextResponse.json({ success: true, updated: results.length, settings: results })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
