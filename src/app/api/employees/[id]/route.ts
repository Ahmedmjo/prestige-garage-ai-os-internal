import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// PATCH /api/employees/[id] — update employee (base salary, status, etc.)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()

    const updateData: any = {}
    if (body.baseSalary !== undefined) updateData.baseSalary = Number(body.baseSalary)
    if (body.jobTitle !== undefined) updateData.jobTitle = body.jobTitle
    if (body.phone !== undefined) updateData.phone = body.phone
    if (body.status !== undefined) updateData.status = body.status
    if (body.notes !== undefined) updateData.notes = body.notes
    if (body.hireDate !== undefined) updateData.hireDate = body.hireDate ? new Date(body.hireDate) : null
    if (body.name !== undefined) updateData.name = body.name

    const emp = await db.employee.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(emp)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE /api/employees/[id] — soft delete (mark as محذوف) or hard delete
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const hard = searchParams.get('hard') === 'true'

    if (hard) {
      await db.employee.delete({ where: { id } })
      return NextResponse.json({ success: true, action: 'hard_delete' })
    } else {
      // Soft delete — mark as محذوف
      const emp = await db.employee.update({
        where: { id },
        data: { status: 'محذوف' },
      })
      return NextResponse.json({ success: true, action: 'soft_delete', employee: emp })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
