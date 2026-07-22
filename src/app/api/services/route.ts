import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { unifyServiceType } from '@/lib/i18n'

// GET /api/services — list services with optional filters
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const serviceType = searchParams.get('serviceType')
    const month = searchParams.get('month')
    const year = searchParams.get('year')

    const where: any = {}
    if (serviceType && serviceType !== 'all') where.serviceType = serviceType

    const services = await db.service.findMany({
      where,
      orderBy: { date: 'desc' },
      take: 500,
    })

    let filtered = services
    if (month && year) {
      filtered = services.filter(s => {
        const d = new Date(s.date)
        return d.getMonth() + 1 === parseInt(month) && d.getFullYear() === parseInt(year)
      })
    }

    return NextResponse.json(filtered)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/services — add new service record (with terminology unification)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    // Generate code if not provided — uses PREFIX+3-digit pattern (DET001, POL001, THF001...)
    let code = body.code
    if (!code) {
      const { generateServiceCode } = await import('@/lib/service-codes')
      code = await generateServiceCode(body.serviceType)
    }

    // Unify service type terminology
    const unifiedType = unifyServiceType(body.serviceType) || 'أخرى'

    const service = await db.service.create({
      data: {
        code,
        date: body.date ? new Date(body.date) : new Date(),
        plate: body.plate || null,
        clientName: body.clientName || null,
        carType: body.carType || null,
        serviceType: unifiedType,
        serviceCategory: unifiedType,
        price: Number(body.price) || 0,
        paymentMethod: body.paymentMethod || null,
        technician: body.technician || null,
        notes: body.notes || null,
      },
    })

    // Auto-create commission for the technician if amount specified
    if (body.technician && body.commissionAmount && body.commissionAmount > 0) {
      const emp = await db.employee.findUnique({ where: { name: body.technician } })
      if (emp) {
        const d = new Date(service.date)
        await db.commission.create({
          data: {
            employeeId: emp.id,
            employeeName: emp.name,
            date: d,
            month: d.getMonth() + 1,
            year: d.getFullYear(),
            clientName: service.clientName,
            carType: service.carType,
            serviceType: unifiedType,
            serviceCategory: unifiedType,
            amount: Number(body.commissionAmount),
            notes: `عمولة خدمة ${service.code}`,
          },
        })
      }
    }

    return NextResponse.json(service, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
