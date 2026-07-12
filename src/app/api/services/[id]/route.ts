import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { unifyServiceType } from '@/lib/i18n'

// PUT /api/services/[id] — update a service record
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const existing = await db.service.findUnique({ where: { id: params.id } })
    if (!existing) {
      return NextResponse.json({ error: 'الخدمة غير موجودة' }, { status: 404 })
    }

    const unifiedType = body.serviceType ? unifyServiceType(body.serviceType) : existing.serviceType

    const updated = await db.service.update({
      where: { id: params.id },
      data: {
        code: body.code ?? existing.code,
        date: body.date ? new Date(body.date) : existing.date,
        plate: body.plate ?? existing.plate,
        clientName: body.clientName ?? existing.clientName,
        carType: body.carType ?? existing.carType,
        serviceType: unifiedType,
        serviceCategory: unifiedType,
        price: body.price !== undefined ? Number(body.price) : existing.price,
        paymentMethod: body.paymentMethod ?? existing.paymentMethod,
        technician: body.technician ?? existing.technician,
        notes: body.notes ?? existing.notes,
      },
    })

    // Update linked commission if exists
    if (body.technician && body.commissionAmount !== undefined) {
      const emp = await db.employee.findUnique({ where: { name: body.technician } })
      if (emp) {
        // Find existing commission for this service (matched by notes containing service code)
        const linkedCommission = await db.commission.findFirst({
          where: { notes: { contains: existing.code } },
        })
        if (linkedCommission) {
          await db.commission.update({
            where: { id: linkedCommission.id },
            data: {
              amount: Number(body.commissionAmount),
              clientName: updated.clientName,
              carType: updated.carType,
              serviceType: unifiedType,
              serviceCategory: unifiedType,
            },
          })
        } else {
          // Create new commission
          const d = new Date(updated.date)
          await db.commission.create({
            data: {
              employeeId: emp.id,
              employeeName: emp.name,
              date: d,
              month: d.getMonth() + 1,
              year: d.getFullYear(),
              clientName: updated.clientName,
              carType: updated.carType,
              serviceType: unifiedType,
              serviceCategory: unifiedType,
              amount: Number(body.commissionAmount),
              notes: `عمولة خدمة ${updated.code}`,
            },
          })
        }
      }
    }

    return NextResponse.json(updated)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE /api/services/[id] — delete a service record (and its linked commission)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const existing = await db.service.findUnique({ where: { id: params.id } })
    if (!existing) {
      return NextResponse.json({ error: 'الخدمة غير موجودة' }, { status: 404 })
    }

    // Delete any linked commissions
    await db.commission.deleteMany({
      where: { notes: { contains: existing.code } },
    })

    await db.service.delete({ where: { id: params.id } })

    return NextResponse.json({ success: true, message: `تم حذف الخدمة ${existing.code}` })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
