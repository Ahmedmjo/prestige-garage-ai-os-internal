import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/attendance/batch — save full month attendance grid for multiple employees
// Body: {
//   month, year,
//   employees: [{ employeeId, days: [{ day: 1, status: 'ح' }, { day: 2, status: '' }, ...] }]
// }
// - status = ''  → DELETE the record for that day
// - status = 'ح'/'غ'/'إ'/'ر' → UPSERT (create or update)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { month, year, employees } = body

    if (!month || !year || !Array.isArray(employees)) {
      return NextResponse.json({ error: 'البيانات غير مكتملة' }, { status: 400 })
    }

    let created = 0
    let updated = 0
    let deleted = 0
    const errors: string[] = []

    for (const empEntry of employees) {
      const { employeeId, days } = empEntry
      if (!employeeId || !Array.isArray(days)) continue

      const emp = await db.employee.findUnique({ where: { id: employeeId } })
      if (!emp) {
        errors.push(`موظف غير موجود: ${employeeId}`)
        continue
      }

      for (const entry of days) {
        const day = Number(entry.day)
        if (!day || day < 1 || day > 31) continue
        const status = entry.status || ''
        // timezone-safe: noon avoids UTC offset shifting to previous day
        const date = new Date(year, month - 1, day, 12, 0, 0, 0)

        if (!status) {
          // DELETE: status empty → remove the record
          try {
            const deletedRec = await db.attendance.deleteMany({
              where: { employeeId, date },
            })
            deleted += deletedRec.count
          } catch (delErr: any) {
            // ignore if not exists
          }
        } else {
          // UPSERT: status present → create or update
          try {
            await db.attendance.upsert({
              where: { employeeId_date: { employeeId, date } },
              update: {
                status,
                month,
                year,
                employeeName: emp.name,
              },
              create: {
                employeeId,
                employeeName: emp.name,
                date,
                status,
                month,
                year,
              },
            })
            // We can't reliably tell if it was create or update without an extra query
            // so we'll just count it as "saved" — the toast will say "saved"
            created++  // approximate (could be update)
          } catch (upsertErr: any) {
            // Fallback: try findFirst + update/create
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
              errors.push(`${emp.name} - يوم ${day}: ${fallbackErr.message}`)
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      created,
      updated,
      deleted,
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined,  // first 5 errors
    })
  } catch (e: any) {
    console.error('Attendance batch POST error:', e)
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
