import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/consumptions — record new roll consumption (auto-deduct + count cars)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const roll = await db.roll.findUnique({ where: { code: body.rollCode } })
    if (!roll) {
      return NextResponse.json({ error: 'كود الرول غير موجود' }, { status: 404 })
    }

    const metersUsed = Number(body.metersUsed) || 0
    const waste = Number(body.waste) || 0
    const totalUsed = metersUsed + waste

    if (totalUsed > (roll.remainingLength || 0)) {
      return NextResponse.json({
        error: `الرصيد غير كافٍ. المتبقي ${roll.remainingLength}م، المطلوب ${totalUsed}م`,
      }, { status: 400 })
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
        usageArea: body.usageArea || null,
        workOrder: body.workOrder || null,
        notes: body.notes || null,
        technician: body.technician || null,
        transactionType: body.transactionType || 'استهلاك',
      },
    })

    const newRemaining = (roll.remainingLength || 0) - totalUsed
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
