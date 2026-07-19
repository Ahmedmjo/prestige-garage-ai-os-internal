import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// PUT /api/consumptions/[id] — update a consumption record
// This will recalculate the roll's remaining length automatically
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const existing = await db.rollConsumption.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'سجل الاستهلاك غير موجود' }, { status: 404 })
    }

    // If roll code is being changed, validate the new roll exists
    let newRoll = null
    const bodyRollCode = (body.rollCode || '').trim()
    if (bodyRollCode && bodyRollCode !== existing.rollCode) {
      newRoll = await db.roll.findUnique({ where: { code: bodyRollCode } })
      if (!newRoll) {
        return NextResponse.json({ error: `كود الرول ${bodyRollCode} غير موجود` }, { status: 404 })
      }
    }

    // Calculate old used amount (before restore, so it's available for validation)
    const oldUsed = (existing.metersUsed || 0) + (existing.waste || 0)

    // First, restore the previous roll's remaining length
    const oldRoll = await db.roll.findUnique({ where: { code: existing.rollCode } })
    if (oldRoll) {
      await db.roll.update({
        where: { id: oldRoll.id },
        data: {
          remainingLength: (oldRoll.remainingLength || 0) + oldUsed,
        },
      })
    }

    const metersUsed = body.metersUsed !== undefined ? Number(body.metersUsed) : existing.metersUsed
    const waste = body.waste !== undefined ? Number(body.waste) : existing.waste
    const totalUsed = metersUsed + waste

    // Determine which roll to deduct from
    const targetRollCode = bodyRollCode || existing.rollCode
    const targetRoll = newRoll || oldRoll
    if (!targetRoll) {
      return NextResponse.json({ error: 'الرول غير موجود' }, { status: 404 })
    }

    // Check if the target roll has enough remaining
    // If same roll: add oldUsed back (already restored above) before checking
    // If different roll: use its current remaining
    // Use rounding to avoid floating-point errors
    const availableAfterRestore = targetRoll.code === existing.rollCode
      ? Math.round(((targetRoll.remainingLength || 0) + oldUsed) * 1000) / 1000
      : Math.round((targetRoll.remainingLength || 0) * 1000) / 1000
    const usedCheck = Math.round(totalUsed * 1000) / 1000

    if (usedCheck > availableAfterRestore) {
      // Rollback the restore
      if (oldRoll) {
        await db.roll.update({
          where: { id: oldRoll.id },
          data: {
            remainingLength: (oldRoll.remainingLength || 0),
          },
        })
      }
      return NextResponse.json({
        error: `الرصيد غير كافٍ في الرول ${targetRollCode}. المتبقي ${availableAfterRestore.toFixed(2)}م، المطلوب ${totalUsed}م`,
      }, { status: 400 })
    }

    // Update the consumption record
    const updated = await db.rollConsumption.update({
      where: { id },
      data: {
        rollId: targetRoll.id,
        rollCode: targetRollCode,
        date: body.date ? new Date(body.date) : existing.date,
        clientName: body.clientName ?? existing.clientName,
        carType: body.carType ?? existing.carType,
        plateNumber: body.plateNumber ?? existing.plateNumber,
        metersUsed,
        waste,
        usageArea: body.usageArea ?? existing.usageArea,
        workOrder: body.workOrder ?? existing.workOrder,
        notes: body.notes ?? existing.notes,
        technician: body.technician ?? existing.technician,
        transactionType: body.transactionType ?? existing.transactionType,
      },
    })

    // Deduct from the target roll
    const newRemaining = Math.round((availableAfterRestore - totalUsed) * 1000) / 1000
    let newStatus = 'active'
    if (newRemaining <= 0) newStatus = 'finished'
    else if (newRemaining <= 2) newStatus = 'low'

    await db.roll.update({
      where: { id: targetRoll.id },
      data: {
        remainingLength: newRemaining,
        status: newStatus,
      },
    })

    return NextResponse.json({
      consumption: updated,
      newRemaining,
      newStatus,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE /api/consumptions/[id] — delete a consumption record
// This will restore the roll's remaining length automatically
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await db.rollConsumption.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'سجل الاستهلاك غير موجود' }, { status: 404 })
    }

    // Restore the roll's remaining length
    const roll = await db.roll.findUnique({ where: { code: existing.rollCode } })
    if (roll) {
      const restored = (roll.remainingLength || 0) + (existing.metersUsed || 0) + (existing.waste || 0)
      let newStatus = 'active'
      if (restored <= 0) newStatus = 'finished'
      else if (restored <= 2) newStatus = 'low'

      await db.roll.update({
        where: { id: roll.id },
        data: {
          remainingLength: restored,
          status: newStatus,
        },
      })
    }

    await db.rollConsumption.delete({ where: { id } })

    return NextResponse.json({
      success: true,
      message: `تم حذف سجل الاستهلاك واسترجاع ${(existing.metersUsed || 0) + (existing.waste || 0)}م للرول ${existing.rollCode}`,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
