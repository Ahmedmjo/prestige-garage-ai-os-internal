import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// PUT /api/penalties/[penaltyId] — edit a penalty
export async function PUT(req: NextRequest, { params }: { params: Promise<{ penaltyId: string }> }) {
  try {
    const { penaltyId } = await params
    const body = await req.json()

    const existing = await db.penalty.findUnique({ where: { id: penaltyId } })
    if (!existing) {
      return NextResponse.json({ error: 'الجزاء غير موجود' }, { status: 404 })
    }

    const d = body.date ? new Date(body.date) : existing.date
    const updated = await db.penalty.update({
      where: { id: penaltyId },
      data: {
        amount: body.amount !== undefined ? Number(body.amount) : existing.amount,
        date: d,
        reason: body.reason ?? existing.reason,
        notes: body.notes ?? existing.notes,
        month: d.getMonth() + 1,
        year: d.getFullYear(),
      },
    })

    return NextResponse.json(updated)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE /api/penalties/[penaltyId] — delete a penalty
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ penaltyId: string }> }) {
  try {
    const { penaltyId } = await params
    await db.penalty.delete({ where: { id: penaltyId } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET /api/penalties/[penaltyId] — get single penalty
export async function GET(req: NextRequest, { params }: { params: Promise<{ penaltyId: string }> }) {
  try {
    const { penaltyId } = await params
    const penalty = await db.penalty.findUnique({ where: { id: penaltyId } })
    if (!penalty) {
      return NextResponse.json({ error: 'الجزاء غير موجود' }, { status: 404 })
    }
    return NextResponse.json(penalty)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
