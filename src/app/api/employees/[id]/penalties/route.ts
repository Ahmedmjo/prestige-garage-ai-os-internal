import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/employees/[id]/penalties — add penalty/deduction
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const emp = await db.employee.findUnique({ where: { id } })
    if (!emp) return NextResponse.json({ error: 'موظف غير موجود' }, { status: 404 })

    const d = body.date ? new Date(body.date) : new Date()
    const penalty = await db.penalty.create({
      data: {
        employeeId: id,
        employeeName: emp.name,
        date: d,
        amount: Number(body.amount) || 0,
        reason: body.reason || null,
        notes: body.notes || null,
        month: d.getMonth() + 1,
        year: d.getFullYear(),
      },
    })

    return NextResponse.json(penalty, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET /api/employees/[id]/penalties — list penalties
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month')
    const year = searchParams.get('year')
    const where: any = { employeeId: id }
    if (month && year) {
      where.month = parseInt(month)
      where.year = parseInt(year)
    }
    const penalties = await db.penalty.findMany({
      where,
      orderBy: { date: 'desc' },
    })
    return NextResponse.json(penalties)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
