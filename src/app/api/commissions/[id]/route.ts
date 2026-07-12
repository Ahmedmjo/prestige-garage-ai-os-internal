import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/commissions/[id] — get single commission
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const commission = await db.commission.findUnique({ where: { id } })
    if (!commission) {
      return NextResponse.json({ error: 'العمولة غير موجودة' }, { status: 404 })
    }
    return NextResponse.json(commission)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PUT /api/commissions/[id] — edit a commission
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()

    const existing = await db.commission.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'العمولة غير موجودة' }, { status: 404 })
    }

    const d = body.date ? new Date(body.date) : existing.date
    const updated = await db.commission.update({
      where: { id },
      data: {
        employeeId: body.employeeId ?? existing.employeeId,
        employeeName: body.employeeName ?? existing.employeeName,
        date: d,
        month: d ? d.getMonth() + 1 : existing.month,
        year: d ? d.getFullYear() : existing.year,
        clientName: body.clientName ?? existing.clientName,
        carType: body.carType ?? existing.carType,
        serviceType: body.serviceType ?? existing.serviceType,
        serviceCategory: body.serviceCategory ?? existing.serviceCategory,
        amount: body.amount !== undefined ? Number(body.amount) : existing.amount,
        notes: body.notes ?? existing.notes,
      },
    })

    return NextResponse.json(updated)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE /api/commissions/[id] — delete a commission
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.commission.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
