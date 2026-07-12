import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// PUT /api/employees/[id]/advances/[advanceId] — edit an advance
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; advanceId: string }> }) {
  try {
    const { id, advanceId } = await params
    const body = await req.json()

    const existing = await db.advance.findUnique({ where: { id: advanceId, employeeId: id } })
    if (!existing) {
      return NextResponse.json({ error: 'السلفة غير موجودة' }, { status: 404 })
    }

    const d = body.date ? new Date(body.date) : existing.date
    const updated = await db.advance.update({
      where: { id: advanceId },
      data: {
        amount: body.amount !== undefined ? Number(body.amount) : existing.amount,
        date: d,
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

// DELETE /api/employees/[id]/advances/[advanceId] — delete an advance
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; advanceId: string }> }) {
  try {
    const { id, advanceId } = await params
    await db.advance.delete({
      where: { id: advanceId, employeeId: id },
    })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET /api/employees/[id]/advances/[advanceId] — get single advance
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; advanceId: string }> }) {
  try {
    const { id, advanceId } = await params
    const advance = await db.advance.findUnique({
      where: { id: advanceId, employeeId: id },
    })
    if (!advance) {
      return NextResponse.json({ error: 'السلفة غير موجودة' }, { status: 404 })
    }
    return NextResponse.json(advance)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
