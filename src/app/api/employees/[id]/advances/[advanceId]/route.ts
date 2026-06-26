import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// DELETE /api/employees/[id]/advances/[advanceId] — delete an advance
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; advanceId: string }> }) {
  try {
    const { id, advanceId } = await params
    await db.advance.delete({
      where: { id: advanceId, employeeId: id },
    })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET /api/employees/[id]/advances — list advances for employee
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
    const advances = await db.advance.findMany({
      where,
      orderBy: { date: 'desc' },
    })
    return NextResponse.json(advances)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
