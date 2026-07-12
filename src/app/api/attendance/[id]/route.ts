import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// PUT /api/attendance/[id] — edit a single attendance record
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()

    const existing = await db.attendance.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'السجل غير موجود' }, { status: 404 })
    }

    const d = body.date ? new Date(body.date) : existing.date
    const updated = await db.attendance.update({
      where: { id },
      data: {
        employeeId: body.employeeId ?? existing.employeeId,
        employeeName: body.employeeName ?? existing.employeeName,
        date: d,
        status: body.status ?? existing.status,
        month: d.getMonth() + 1,
        year: d.getFullYear(),
        notes: body.notes ?? existing.notes,
      },
    })

    return NextResponse.json(updated)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE /api/attendance/[id] — delete a single attendance record
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.attendance.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET /api/attendance/[id] — get single attendance record
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const record = await db.attendance.findUnique({ where: { id } })
    if (!record) {
      return NextResponse.json({ error: 'السجل غير موجود' }, { status: 404 })
    }
    return NextResponse.json(record)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
