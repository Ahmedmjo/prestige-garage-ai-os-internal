import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Helper function to suggest a code based on brand + type
function suggestCode(brand: string, type: string, existingCount: number): string {
  const brandPrefix = (brand || 'GEN').slice(0, 3).toUpperCase()
  const typePrefix = (type || 'GEN').slice(0, 3).toUpperCase()
  return `${brandPrefix}-${typePrefix}-${String(existingCount + 1).padStart(3, '0')}`
}

// PUT /api/rolls/[id] — update a roll record (including price, length, etc.)
// When code changes, automatically updates all related consumption records' rollCode
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const existing = await db.roll.findUnique({ where: { id: params.id } })
    if (!existing) {
      return NextResponse.json({ error: 'الرول غير موجود' }, { status: 404 })
    }

    // If code is being changed, check uniqueness
    const isCodeChanged = body.code && body.code !== existing.code
    if (isCodeChanged) {
      const conflict = await db.roll.findUnique({ where: { code: body.code } })
      if (conflict) {
        return NextResponse.json({ error: `كود الرول ${body.code} موجود مسبقاً` }, { status: 400 })
      }
    }

    // Calculate new remainingLength if totalLength changed
    let newRemaining = existing.remainingLength
    if (body.totalLength !== undefined) {
      const newTotal = Number(body.totalLength)
      const usedSoFar = (existing.totalLength || 0) - (existing.remainingLength || 0)
      newRemaining = Math.max(0, newTotal - usedSoFar)
    }

    // Determine new status based on thresholds (5m, 2m, 0m)
    let newStatus = existing.status
    if (newRemaining !== existing.remainingLength) {
      newStatus = 'active'
      if (newRemaining <= 0) newStatus = 'finished'
      else if (newRemaining <= 2) newStatus = 'low'
    }

    const updated = await db.roll.update({
      where: { id: params.id },
      data: {
        code: body.code ?? existing.code,
        brand: body.brand ?? existing.brand,
        type: body.type ?? existing.type,
        model: body.model ?? existing.model,
        width: body.width !== undefined ? (body.width ? Number(body.width) : null) : existing.width,
        totalLength: body.totalLength !== undefined ? Number(body.totalLength) : existing.totalLength,
        remainingLength: newRemaining,
        price: body.price !== undefined ? (body.price ? Number(body.price) : null) : existing.price,
        supplier: body.supplier ?? existing.supplier,
        rollCategory: body.rollCategory ?? existing.rollCategory,
        purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : existing.purchaseDate,
        notes: body.notes ?? existing.notes,
        status: newStatus,
      },
    })

    // If code changed, update ALL related consumption records' rollCode
    let updatedConsumptions = 0
    if (isCodeChanged) {
      const updateResult = await db.rollConsumption.updateMany({
        where: { rollId: params.id },
        data: { rollCode: body.code },
      })
      updatedConsumptions = updateResult.count
    }

    return NextResponse.json({
      ...updated,
      _info: isCodeChanged
        ? `تم تحديث ${updatedConsumptions} سجل استهلاك بالكود الجديد`
        : undefined,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE /api/rolls/[id] — delete a roll (only if no consumptions linked)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const existing = await db.roll.findUnique({
      where: { id: params.id },
      include: { consumptions: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'الرول غير موجود' }, { status: 404 })
    }

    if (existing.consumptions && existing.consumptions.length > 0) {
      return NextResponse.json({
        error: `لا يمكن حذف الرول لأنه مرتبط بـ ${existing.consumptions.length} سجل استهلاك. احذف سجلات الاستهلاك أولاً.`,
      }, { status: 400 })
    }

    await db.roll.delete({ where: { id: params.id } })

    return NextResponse.json({ success: true, message: `تم حذف الرول ${existing.code}` })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET /api/rolls/[id] — get roll with suggested code
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const roll = await db.roll.findUnique({ where: { id: params.id } })
    if (!roll) {
      return NextResponse.json({ error: 'الرول غير موجود' }, { status: 404 })
    }
    return NextResponse.json({
      currentCode: roll.code,
      brand: roll.brand,
      type: roll.type,
      suggestedCode: suggestCode(roll.brand, roll.type, 0),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
