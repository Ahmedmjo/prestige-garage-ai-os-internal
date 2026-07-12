import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/ai/protection-action
// Handles AI assistant commands for protection (PPF) operations
// Supports:
//   - Register consumption with OB number (work order)
//   - "نفس السابق" — same client, different roll
//   - Multiple rolls on same OB
//   - Fuzzy matching for roll codes

interface ActionRequest {
  action: 'register_consumption' | 'multi_roll_consumption' | 'next_ob' | 'fuzzy_search_roll'
  // For register_consumption
  rollCode?: string
  clientName?: string
  carType?: string
  plateNumber?: string
  metersUsed?: number
  waste?: number
  usageArea?: string
  workOrder?: string  // OB number
  technician?: string
  notes?: string
  transactionType?: string
  date?: string
  // For multi_roll_consumption
  consumptions?: Array<{
    rollCode: string
    metersUsed: number
    waste?: number
    usageArea?: string
  }>
  // For fuzzy_search_roll
  partialCode?: string
}

// Fuzzy match a roll code
async function fuzzyMatchRoll(partial: string) {
  const partialUpper = partial.toUpperCase().trim()
  // Try exact match first
  const exact = await db.roll.findUnique({ where: { code: partialUpper } })
  if (exact) return [exact]

  // Try contains match
  const rolls = await db.roll.findMany({
    where: {
      OR: [
        { code: { contains: partialUpper, mode: 'insensitive' } },
        { brand: { contains: partial, mode: 'insensitive' } },
        { type: { contains: partial, mode: 'insensitive' } },
      ],
    },
    take: 10,
  })
  return rolls
}

// Generate next OB number
async function generateNextOB(): Promise<string> {
  const lastConsumption = await db.rollConsumption.findFirst({
    where: { workOrder: { startsWith: 'OB-' } },
    orderBy: { workOrder: 'desc' },
  })

  if (!lastConsumption || !lastConsumption.workOrder) {
    return 'OB-0001'
  }

  const match = lastConsumption.workOrder.match(/OB-(\d+)/)
  if (!match) return 'OB-0001'
  const nextNum = parseInt(match[1], 10) + 1
  return `OB-${String(nextNum).padStart(4, '0')}`
}

export async function POST(req: NextRequest) {
  try {
    const body: ActionRequest = await req.json()

    switch (body.action) {
      case 'fuzzy_search_roll': {
        if (!body.partialCode) {
          return NextResponse.json({ error: 'partialCode مطلوب' }, { status: 400 })
        }
        const matches = await fuzzyMatchRoll(body.partialCode)
        return NextResponse.json({
          query: body.partialCode,
          matches: matches.map(r => ({
            code: r.code,
            brand: r.brand,
            type: r.type,
            model: r.model,
            remainingLength: r.remainingLength,
            status: r.status,
          })),
          count: matches.length,
        })
      }

      case 'next_ob': {
        const nextOB = await generateNextOB()
        // Also return last few OBs for context
        const recentOBs = await db.rollConsumption.findMany({
          where: { workOrder: { startsWith: 'OB-' } },
          orderBy: { workOrder: 'desc' },
          take: 5,
          distinct: ['workOrder'],
        })
        return NextResponse.json({
          nextOB,
          recentOBs: recentOBs.map(c => ({
            workOrder: c.workOrder,
            clientName: c.clientName,
            carType: c.carType,
            date: c.date,
          })),
        })
      }

      case 'register_consumption': {
        // Standard single consumption registration
        if (!body.rollCode || body.metersUsed === undefined) {
          return NextResponse.json({ error: 'rollCode و metersUsed مطلوبان' }, { status: 400 })
        }

        // Fuzzy match the roll code
        const matches = await fuzzyMatchRoll(body.rollCode)
        if (matches.length === 0) {
          return NextResponse.json({
            error: `لم يتم العثور على رول بكود "${body.rollCode}"`,
            suggestions: [],
          }, { status: 404 })
        }
        if (matches.length > 1) {
          return NextResponse.json({
            error: `يوجد ${matches.length} رول مطابق لكود "${body.rollCode}". حدد الكود الكامل:`,
            suggestions: matches.map(r => `${r.code} (${r.brand} ${r.type} - متبقي ${r.remainingLength?.toFixed(1)}م)`),
          }, { status: 400 })
        }

        const roll = matches[0]
        const metersUsed = Number(body.metersUsed) || 0
        const waste = Number(body.waste) || 0
        const totalUsed = metersUsed + waste

        if (totalUsed > (roll.remainingLength || 0)) {
          return NextResponse.json({
            error: `الرصيد غير كافٍ في الرول ${roll.code}. المتبقي ${roll.remainingLength?.toFixed(2)}م، المطلوب ${totalUsed}م`,
          }, { status: 400 })
        }

        // Auto-generate OB if not provided
        const workOrder = body.workOrder || await generateNextOB()

        const consumption = await db.rollConsumption.create({
          data: {
            rollId: roll.id,
            rollCode: roll.code,
            date: body.date ? new Date(body.date) : new Date(),
            clientName: body.clientName || null,
            carType: body.carType || null,
            plateNumber: body.plateNumber || null,
            metersUsed,
            waste,
            usageArea: body.usageArea || null,
            workOrder,
            notes: body.notes || null,
            technician: body.technician || null,
            transactionType: body.transactionType || 'استهلاك',
          },
        })

        // Deduct from roll
        const newRemaining = (roll.remainingLength || 0) - totalUsed
        let newStatus = 'active'
        if (newRemaining <= 0) newStatus = 'finished'
        else if (newRemaining <= 2) newStatus = 'low'

        const newCarsCount = body.clientName ? (roll.carsCount || 0) + 1 : roll.carsCount
        await db.roll.update({
          where: { id: roll.id },
          data: {
            remainingLength: newRemaining,
            status: newStatus,
            carsCount: newCarsCount,
          },
        })

        return NextResponse.json({
          success: true,
          consumption,
          rollCode: roll.code,
          workOrder,
          newRemaining,
          newStatus,
          message: `✅ تم تسجيل استهلاك ${metersUsed}م من الرول ${roll.code} بأمر الشغل ${workOrder}. المتبقي: ${newRemaining.toFixed(2)}م`,
        }, { status: 201 })
      }

      case 'multi_roll_consumption': {
        // Register multiple consumptions on the SAME OB (same client)
        if (!body.consumptions || body.consumptions.length === 0) {
          return NextResponse.json({ error: 'consumptions array مطلوب' }, { status: 400 })
        }
        if (!body.clientName && !body.workOrder) {
          return NextResponse.json({ error: 'clientName أو workOrder مطلوب' }, { status: 400 })
        }

        // Generate or use existing OB
        const workOrder = body.workOrder || await generateNextOB()

        const results: any[] = []
        const errors: any[] = []

        // Process each consumption
        for (let i = 0; i < body.consumptions.length; i++) {
          const c = body.consumptions[i]
          if (!c.rollCode || c.metersUsed === undefined) {
            errors.push({ index: i, error: 'rollCode و metersUsed مطلوبان' })
            continue
          }

          // Fuzzy match
          const matches = await fuzzyMatchRoll(c.rollCode)
          if (matches.length === 0) {
            errors.push({ index: i, rollCode: c.rollCode, error: `لم يتم العثور على رول بكود "${c.rollCode}"` })
            continue
          }
          if (matches.length > 1) {
            errors.push({
              index: i,
              rollCode: c.rollCode,
              error: `يوجد ${matches.length} رول مطابق`,
              suggestions: matches.map(r => `${r.code} (${r.brand} ${r.type})`),
            })
            continue
          }

          const roll = matches[0]
          const metersUsed = Number(c.metersUsed) || 0
          const waste = Number(c.waste) || 0
          const totalUsed = metersUsed + waste

          if (totalUsed > (roll.remainingLength || 0)) {
            errors.push({
              index: i,
              rollCode: c.rollCode,
              error: `الرصيد غير كافٍ. المتبقي ${roll.remainingLength?.toFixed(2)}م، المطلوب ${totalUsed}م`,
            })
            continue
          }

          const consumption = await db.rollConsumption.create({
            data: {
              rollId: roll.id,
              rollCode: roll.code,
              date: body.date ? new Date(body.date) : new Date(),
              clientName: body.clientName || null,
              carType: body.carType || null,
              plateNumber: body.plateNumber || null,
              metersUsed,
              waste,
              usageArea: c.usageArea || null,
              workOrder,
              notes: body.notes || null,
              technician: body.technician || null,
              transactionType: body.transactionType || 'استهلاك',
            },
          })

          const newRemaining = (roll.remainingLength || 0) - totalUsed
          let newStatus = 'active'
          if (newRemaining <= 0) newStatus = 'finished'
          else if (newRemaining <= 2) newStatus = 'low'

          const newCarsCount = body.clientName ? (roll.carsCount || 0) + 1 : roll.carsCount
          await db.roll.update({
            where: { id: roll.id },
            data: {
              remainingLength: newRemaining,
              status: newStatus,
              carsCount: newCarsCount,
            },
          })

          results.push({
            rollCode: roll.code,
            metersUsed,
            waste,
            newRemaining,
            consumptionId: consumption.id,
          })
        }

        const successCount = results.length
        const errorCount = errors.length

        let message = `✅ تم تسجيل ${successCount} استهلاك بأمر الشغل ${workOrder} للعميل ${body.clientName || 'غير محدد'}`
        if (errorCount > 0) {
          message += `\n⚠️ فشل في ${errorCount} استهلاك`
        }

        return NextResponse.json({
          success: errorCount === 0,
          workOrder,
          clientName: body.clientName,
          results,
          errors,
          successCount,
          errorCount,
          message,
        }, { status: 201 })
      }

      default:
        return NextResponse.json({ error: 'action غير معروف' }, { status: 400 })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET /api/ai/protection-action — get current OB info and recent consumptions
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const ob = searchParams.get('ob')

    if (ob) {
      // Get all consumptions for this OB
      const consumptions = await db.rollConsumption.findMany({
        where: { workOrder: ob },
        orderBy: { date: 'desc' },
      })
      return NextResponse.json({
        workOrder: ob,
        count: consumptions.length,
        consumptions: consumptions.map(c => ({
          id: c.id,
          rollCode: c.rollCode,
          clientName: c.clientName,
          carType: c.carType,
          metersUsed: c.metersUsed,
          waste: c.waste,
          usageArea: c.usageArea,
          date: c.date,
          notes: c.notes,
        })),
      })
    }

    // Default: return next OB and recent OBs
    const nextOB = await generateNextOB()
    const recentConsumptions = await db.rollConsumption.findMany({
      where: { workOrder: { startsWith: 'OB-' } },
      orderBy: { date: 'desc' },
      take: 10,
      include: { roll: true },
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
          rolls: [],
        }
      }
      obGroups[c.workOrder].totalMeters += c.metersUsed || 0
      obGroups[c.workOrder].rolls.push({
        rollCode: c.rollCode,
        metersUsed: c.metersUsed,
        waste: c.waste,
        usageArea: c.usageArea,
      })
    }

    return NextResponse.json({
      nextOB,
      recentOBs: Object.values(obGroups).slice(0, 5),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
