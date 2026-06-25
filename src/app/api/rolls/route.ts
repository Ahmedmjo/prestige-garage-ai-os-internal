import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/rolls — list all rolls with consumptions
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')
    const where: any = {}
    if (category && category !== 'all') where.rollCategory = category

    const rolls = await db.roll.findMany({
      where,
      include: { consumptions: { orderBy: { date: 'desc' }, take: 5 } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(rolls)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/rolls — create new roll (code is OPTIONAL, auto-suggested)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Auto-suggest code if not provided
    let code = body.code
    if (!code) {
      const brandPrefix = (body.brand || 'GEN').slice(0, 3).toUpperCase()
      const typePrefix = (body.type || 'GEN').slice(0, 3).toUpperCase()
      const count = await db.roll.count()
      code = `${brandPrefix}-${typePrefix}-${String(count + 1).padStart(3, '0')}`
    }

    // Check code uniqueness
    const existing = await db.roll.findUnique({ where: { code } })
    if (existing) {
      return NextResponse.json({ error: `كود الرول ${code} موجود مسبقاً` }, { status: 400 })
    }

    const totalLength = Number(body.totalLength) || 0
    const price = Number(body.price) || 0
    const rollCategory = body.rollCategory || 'ppf'

    const roll = await db.roll.create({
      data: {
        code,
        brand: body.brand || '',
        type: body.type || '',
        model: body.model || null,
        width: body.width ? Number(body.width) : null,
        totalLength,
        remainingLength: totalLength,
        price,
        supplier: body.supplier || null,
        rollCategory,
        purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : null,
        notes: body.notes || null,
        status: 'active',
        carsCount: 0,
      },
    })

    if (totalLength <= 2) {
      await db.alert.create({
        data: {
          type: 'roll_low',
          severity: totalLength <= 0 ? 'critical' : 'warning',
          title: `رول جديد ${roll.code} - مخزون منخفض`,
          message: `تم إضافة رول ${roll.brand} ${roll.type} بطول ${totalLength}م فقط`,
          relatedId: roll.id,
          relatedType: 'roll',
        },
      })
    }

    return NextResponse.json(roll, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
