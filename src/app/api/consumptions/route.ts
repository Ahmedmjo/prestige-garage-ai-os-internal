import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Normalize OB format: Bo020, bo020, bo-020, OB0020, OB 020 → OB-0020
function normalizeOB(workOrder: string | null | undefined): string | null {
  if (!workOrder) return null
  const w = workOrder.trim()
  const obMatch = w.match(/(?:OB|BO|bo|Bo)[-\s]*(\d+)/i)
  if (obMatch) {
    return `OB-${obMatch[1].padStart(4, '0')}`
  }
  return w || null
}

// POST /api/consumptions — record new roll consumption (auto-deduct + count cars)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const rollCode = (body.rollCode || '').trim()
    const roll = await db.roll.findUnique({ where: { code: rollCode } })
    if (!roll) {
      return NextResponse.json({ error: `كود الرول ${rollCode} غير موجود` }, { status: 404 })
    }

    const metersUsed = Number(body.metersUsed) || 0
    const waste = Number(body.waste) || 0
    const totalUsed = metersUsed + waste

    // Use rounding to avoid floating-point errors (2.0 vs 1.9999999999)
    const remaining = Math.round((roll.remainingLength || 0) * 1000) / 1000
    const used = Math.round(totalUsed * 1000) / 1000

    if (used > remaining) {
      return NextResponse.json({
        error: `الرصيد غير كافٍ. المتبقي ${remaining.toFixed(2)}م، المطلوب ${used.toFixed(2)}م`,
      }, { status: 400 })
    }

    // Normalize OB number
    const workOrder = normalizeOB(body.workOrder)

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

    const newRemaining = Math.round((remaining - used) * 1000) / 1000
    let newStatus = 'active'
    if (newRemaining <= 0) newStatus = 'finished'
    else if (newRemaining <= 2) newStatus = 'low'

    // Increment carsCount if this consumption has a client (i.e., a real car serviced)
    const newCarsCount = body.clientName ? (roll.carsCount || 0) + 1 : roll.carsCount

    await db.roll.update({
      where: { id: roll.id },
      data: {
        remainingLength: newRemaining,
        status: newStatus,
        carsCount: newCarsCount,
      },
    })

    if (newStatus !== 'active' && roll.status === 'active') {
      await db.alert.create({
        data: {
          type: 'roll_low',
          severity: newStatus === 'finished' ? 'critical' : 'warning',
          title: `رول ${roll.code} ${newStatus === 'finished' ? 'منتهي' : 'أوشك على النفاذ'}`,
          message: `الرول ${roll.brand} ${roll.type} (${roll.code}) — المتبقي ${newRemaining.toFixed(2)} متر`,
          relatedId: roll.id,
          relatedType: 'roll',
        },
      })
    }

    return NextResponse.json({
      consumption,
      newRemaining,
      newStatus,
      carsCount: newCarsCount,
    }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET /api/consumptions — list all consumptions
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const rollCode = searchParams.get('rollCode')
    const where = rollCode ? { rollCode } : {}
    const consumptions = await db.rollConsumption.findMany({
      where,
      orderBy: { date: 'desc' },
      take: 200,
    })
    return NextResponse.json(consumptions)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
