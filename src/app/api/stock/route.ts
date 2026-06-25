import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/stock — list all stock items by category
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')
    const where = category && category !== 'all' ? { category } : {}
    const items = await db.stockItem.findMany({
      where,
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(items)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/stock — add stock item (with name unification)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const name = body.name?.trim()
    if (!name) return NextResponse.json({ error: 'الاسم مطلوب' }, { status: 400 })

    // Check for existing item with same name
    const existing = await db.stockItem.findUnique({ where: { name } })
    if (existing) {
      return NextResponse.json({ error: `الصنف "${name}" موجود مسبقاً` }, { status: 400 })
    }

    const currentQty = Number(body.currentQty) || 0
    const minLevel = Number(body.minLevel) || 0
    let status = 'كافي'
    if (currentQty <= 0) status = 'نفد'
    else if (currentQty < minLevel) status = 'منخفض'

    const item = await db.stockItem.create({
      data: {
        name,
        category: body.category || 'detailing',
        unit: body.unit || 'ml',
        totalReceived: Number(body.totalReceived) || currentQty,
        totalWithdrawn: Number(body.totalWithdrawn) || 0,
        currentQty,
        minLevel,
        status,
        unitPrice: Number(body.unitPrice) || 0,
      },
    })

    // If item has initial quantity, record it as a movement
    if (currentQty > 0) {
      await db.stockMovement.create({
        data: {
          itemId: item.id,
          itemName: item.name,
          date: new Date(),
          materialType: item.category,
          movementType: 'استلام',
          quantity: currentQty,
          unit: item.unit,
          unitPrice: item.unitPrice,
          totalCost: currentQty * item.unitPrice,
          notes: 'رصيد افتتاحي',
        },
      })
    }

    return NextResponse.json(item, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
