import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// DELETE /api/penalties/[penaltyId] — delete a penalty
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ penaltyId: string }> }) {
  try {
    const { penaltyId } = await params
    await db.penalty.delete({ where: { id: penaltyId } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
