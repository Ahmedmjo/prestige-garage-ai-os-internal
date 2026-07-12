import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/commissions — list all commissions (optionally filtered by employeeId, month, year)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const employeeId = searchParams.get('employeeId')
    const month = searchParams.get('month')
    const year = searchParams.get('year')

    const where: any = {}
    if (employeeId) where.employeeId = employeeId
    if (month && year) {
      where.month = parseInt(month)
      where.year = parseInt(year)
    }

    const commissions = await db.commission.findMany({
      where,
      orderBy: { date: 'desc' },
      take: 500,
    })
    return NextResponse.json(commissions)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/commissions — create a new commission
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Find employee by name if employeeId not provided
    let employeeId = body.employeeId
    let employeeName = body.employeeName
    if (!employeeId && body.employeeName) {
      const emp = await db.employee.findUnique({ where: { name: body.employeeName } })
      if (emp) {
        employeeId = emp.id
        employeeName = emp.name
      } else {
        return NextResponse.json({ error: `الموظف "${body.employeeName}" غير موجود` }, { status: 404 })
      }
    }

    if (!employeeId || !employeeName) {
      return NextResponse.json({ error: 'employeeId أو employeeName مطلوب' }, { status: 400 })
    }

    const d = body.date ? new Date(body.date) : new Date()
    const commission = await db.commission.create({
      data: {
        employeeId,
        employeeName,
        date: d,
        month: d.getMonth() + 1,
        year: d.getFullYear(),
        monthLabel: body.monthLabel || null,
        clientName: body.clientName || null,
        carType: body.carType || null,
        serviceType: body.serviceType || null,
        serviceCategory: body.serviceCategory || null,
        amount: Number(body.amount) || 0,
        notes: body.notes || null,
      },
    })

    return NextResponse.json(commission, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
