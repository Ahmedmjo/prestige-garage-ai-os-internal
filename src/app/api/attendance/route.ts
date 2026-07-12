import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/attendance — list all attendance records (optionally filtered)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month')
    const year = searchParams.get('year')
    const employeeId = searchParams.get('employeeId')

    const where: any = {}
    if (month && year) {
      where.month = parseInt(month)
      where.year = parseInt(year)
    }
    if (employeeId) where.employeeId = employeeId

    const records = await db.attendance.findMany({
      where,
      orderBy: { date: 'desc' },
      take: 1000,
    })
    return NextResponse.json(records)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/attendance — create a single attendance record
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    let employeeId = body.employeeId
    let employeeName = body.employeeName
    if (!employeeId && body.employeeName) {
      const emp = await db.employee.findUnique({ where: { name: body.employeeName } })
      if (emp) {
        employeeId = emp.id
        employeeName = emp.name
      }
    }

    if (!employeeId || !employeeName) {
      return NextResponse.json({ error: 'employeeId أو employeeName مطلوب' }, { status: 400 })
    }

    const d = body.date ? new Date(body.date) : new Date()
    const record = await db.attendance.create({
      data: {
        employeeId,
        employeeName,
        date: d,
        status: body.status || 'ح',
        month: d.getMonth() + 1,
        year: d.getFullYear(),
        notes: body.notes || null,
      },
    })

    return NextResponse.json(record, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
