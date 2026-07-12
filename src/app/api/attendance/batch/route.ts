import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/attendance/batch — save full month attendance grid for an employee
// Body: { employeeId, month, year, days: [{ day: 1, status: 'ح' }, ...] }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { employeeId, month, year, days } = body

    if (!employeeId || !month || !year || !Array.isArray(days)) {
      return NextResponse.json({ error: 'البيانات غير مكتملة' }, { status: 400 })
    }

    const emp = await db.employee.findUnique({ where: { id: employeeId } })
    if (!emp) return NextResponse.json({ error: 'موظف غير موجود' }, { status: 404 })

    let updated = 0
    let created = 0
    const errors: string[] = []

    for (const entry of days) {
      const day = Number(entry.day)
      if (!day || day < 1 || day > 31) continue
      const date = new Date(year, month - 1, day)
      const status = entry.status || 'غ'

      try {
        // Try upsert first (requires unique constraint on employeeId_date)
        const result = await db.attendance.upsert({
          where: { employeeId_date: { employeeId, date } },
          update: { status, month, year, employeeName: emp.name },
          create: {
            employeeId,
            employeeName: emp.name,
            date,
            status,
            month,
            year,
          },
        })
        // Check if it was update or create by checking createdAt
        if (result.createdAt && new Date(result.createdAt).getTime() === result.updatedAt.getTime()) {
          created++
        } else {
          updated++
        }
      } catch (upsertErr: any) {
        // Fallback: try findFirst + update/create if unique constraint not available
        try {
          const existing = await db.attendance.findFirst({
            where: { employeeId, date },
          })
          if (existing) {
            await db.attendance.update({
              where: { id: existing.id },
              data: { status, month, year, employeeName: emp.name },
            })
            updated++
          } else {
            await db.attendance.create({
              data: {
                employeeId,
                employeeName: emp.name,
                date,
                status,
                month,
                year,
              },
            })
            created++
          }
        } catch (fallbackErr: any) {
          errors.push(`Day ${day}: ${fallbackErr.message}`)
        }
      }
    }

    return NextResponse.json({
      success: true,
      updated,
      created,
      total: days.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET /api/attendance/batch — get attendance for all employees in a month
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))

    const attendance = await db.attendance.findMany({
      where: { month, year },
      orderBy: { date: 'asc' },
    })

    const byEmployee: Record<string, { [day: number]: any }> = {}
    for (const a of attendance) {
      const day = new Date(a.date).getDate()
      if (!byEmployee[a.employeeId]) byEmployee[a.employeeId] = {}
      byEmployee[a.employeeId][day] = a
    }

    return NextResponse.json({ byEmployee, month, year })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
