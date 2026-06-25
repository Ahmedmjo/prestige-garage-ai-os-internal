/**
 * Seed Prestige Garage database v2 — fixed salary, stock unification, etc.
 */
import { db } from '../src/lib/db'
import seedData from './seed_data.json'

function toDate(s?: string | null): Date | null {
  if (!s) return null
  if (s.includes('/')) {
    const [dd, mm, yyyy] = s.split('/')
    return new Date(`${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`)
  }
  return new Date(s)
}

function toFloat(v: any): number {
  if (v === null || v === undefined || v === '') return 0
  const n = Number(v)
  return isNaN(n) ? 0 : n
}

// ─── Stock name unification map ─────────────────────────────
// Merge items that refer to the same product under one canonical name
function unifyStockName(name: string, category: string): string {
  const n = name.trim()
  // Detailing products unification (handle Jerican vs L, etc.)
  if (n.match(/Sonax Insect Remover/i)) return 'Sonax Insect Remover'
  if (n.match(/Sonax Multistar/i)) return 'Sonax Multistar'
  if (n.match(/Sonax MoS2 Oil 339/i)) return 'Sonax MoS2 Oil 339'
  if (n.match(/Tyre Shine/i)) return 'Tyre Shine'
  if (n.match(/Sonax Profiline Refresh/i)) return 'Sonax Profiline Refresh'
  if (n.match(/Sonax Profiline Shiny Wheels/i)) return 'Sonax Profiline Shiny Wheels'
  if (n.match(/Sonax Profiline Multiclean/i)) return 'Sonax Profiline Multiclean Alkaline'
  if (n.match(/Sonax Rim Cleaner 230/i)) return 'Sonax Rim Cleaner 230'
  if (n.match(/Sonax Profiline CutMax/i)) return 'Sonax Profiline CutMax 6/4'
  if (n.match(/Sonax Profiline EX/i)) return 'Sonax Profiline EX 04-06'
  if (n.match(/Sonax Profiline FS/i)) return 'Sonax Profiline FS 05-04'
  if (n.match(/Sonax Profiline HW/i)) return 'Sonax Profiline HW 02-04'
  if (n.match(/Sonax Profiline NP/i)) return 'Sonax Profiline NP 03-06'
  if (n.match(/Sonax Profiline OS/i)) return 'Sonax Profiline OS 02-06 Glaze'
  if (n.match(/Sonax Profiline Perfect Finish/i)) return 'Sonax Profiline Perfect Finish 4/6'
  if (n.match(/Sonax Profiline Plastic Cleaner/i)) return 'Sonax Profiline Plastic Cleaner'
  if (n.match(/Sonax Profiline Plastic Protectant/i)) return 'Sonax Profiline Plastic Protectant'
  if (n.match(/Sonax Profiline Polymer NetShield/i)) return 'Sonax Profiline Polymer NetShield'
  if (n.match(/Sonax Profiline Sensitive Surface/i)) return 'Sonax Profiline Sensitive Surface'
  if (n.match(/Sonax Profiline Stain Ex/i)) return 'Sonax Profiline Stain Ex'
  if (n.match(/Sonax Profiline Ultimate Cut/i)) return 'Sonax Profiline Ultimate Cut 6+/3'
  if (n.match(/Sonax Profiline Leather Protection/i)) return 'Sonax Profiline Leather Protection'
  if (n.match(/Sonax Profiline Fabric Coating/i)) return 'Sonax Profiline Fabric Coating'
  if (n.match(/Sonax Profiline CC36/i)) return 'Sonax Profiline CC36 (Step 2)'
  if (n.match(/Sonax Xtreme Ceramic Spray/i)) return 'Sonax Xtreme Ceramic Spray Coating'
  if (n.match(/Sonax Xtreme Ceramic Plastic/i)) return 'Sonax Xtreme Ceramic Plastic'
  if (n.match(/Sonax Xtreme Ceramic Tyre/i)) return 'Sonax Xtreme Ceramic Tyre+Rim'
  if (n.match(/Sonax Xtreme Metal Polish/i)) return 'Sonax Xtreme Metal Polish'
  if (n.match(/Sonax Xtreme PPF/i)) return 'Sonax Xtreme PPF + Vinyl'
  if (n.match(/Sonax Xtreme Wheel Cleaner/i)) return 'Sonax Xtreme Wheel Cleaner 230'
  if (n.match(/Sonax Polish\+Wax Color Black/i)) return 'Sonax Polish+Wax Color Black'
  if (n.match(/Sonax Polish\+Wax Color Blue/i)) return 'Sonax Polish+Wax Color Blue'
  if (n.match(/Sonax Polish\+Wax Color Red/i)) return 'Sonax Polish+Wax Color Red'
  if (n.match(/Sonax Polish\+Wax Color Silver/i)) return 'Sonax Polish+Wax Color Silver'
  if (n.match(/Sonax Polish\+Wax Color White/i)) return 'Sonax Polish+Wax Color White'
  if (n.match(/Sonax Glass Polish/i)) return 'Sonax Glass Polish Intensive'
  return n
}

function categorizeStock(name: string, originalCategory: string): string {
  const n = name.toLowerCase()
  // Nano ceramic
  if (n.includes('ceramic') || n.includes('nano') || n.includes('نانو')) return 'nano'
  // Polish
  if (n.includes('polish') || n.includes('بوليش') || n.includes('cutmax') ||
      n.includes('perfect finish') || n.includes('ultimate cut') ||
      n.includes('cc36') || n.includes('metal polish') || n.includes('color ') ||
      n.includes('color black') || n.includes('glass polish') ||
      n.includes('cc36') || n.includes('ex 04') || n.includes('fs 05') ||
      n.includes('hw 02') || n.includes('np 03') || n.includes('os 02') ||
      n.includes('leather protection') || n.includes('fabric coating') ||
      n.includes('polymer netshield') || n.includes('plastic cleaner') ||
      n.includes('plastic protectant') || n.includes('sensitive surface') ||
      n.includes('stain ex') || n.includes('cutmax') ||
      n.includes('ppf + vinyl') || n.includes('ppf + vinyl detailer')) return 'polish'
  // Detailing (use exact spelling "دتيلنج")
  if (originalCategory === 'ديتيلنج' || n.includes('sonax') && !n.includes('polish') && !n.includes('ceramic') ||
      n.includes('foam') || n.includes('shampoo') || n.includes('insect') ||
      n.includes('multistar') || n.includes('pre-wash') || n.includes('multiclean') ||
      n.includes('refresh') || n.includes('mos2') || n.includes('tyre shine') ||
      n.includes('glass cleaner') || n.includes('interior cleaner') ||
      n.includes('rim cleaner') || n.includes('shiny wheels') ||
      n.includes('dashboard dressing') || n.includes('wax shampoo') ||
      n.includes('clear glass') || n.includes('xtreme wheel')) return 'detailing'
  // Tools / equipment
  if (n.includes('pad') || n.includes('sponge') || n.includes('cloth') ||
      n.includes('microfibre') || n.includes('microfiber') || n.includes('lambskin') ||
      n.includes('wool') || n.includes('towel') || n.includes('brush') ||
      originalCategory === 'أدوات ومعدات' || originalCategory.includes('أدوات')) return 'tools'
  return 'detailing'
}

// Map unit: liquids → ml, packs → pack, others → unit
function unifyUnit(name: string, originalUnit: string): string {
  const n = name.toLowerCase()
  if (n.includes('polish') || n.includes('ceramic') || n.includes('coating') ||
      n.includes('glaze') || n.includes('spray') || n.includes('protect') ||
      n.includes('cleaner') || n.includes('stain') || n.includes('netshield') ||
      n.includes('plastic') || n.includes('leather') || n.includes('fabric') ||
      n.includes('metal') || n.includes('color ') || n.includes('glass polish') ||
      n.includes('ppf') || n.includes('sensitive')) return 'pack'
  if (originalUnit === 'لتر' || n.includes('foam') || n.includes('shampoo') ||
      n.includes('insect') || n.includes('multistar') || n.includes('mos2') ||
      n.includes('tyre') || n.includes('glass cleaner') || n.includes('interior') ||
      n.includes('rim cleaner') || n.includes('shiny wheels') || n.includes('refresh') ||
      n.includes('multiclean') || n.includes('pre-wash') || n.includes('dashboard') ||
      n.includes('wax shampoo') || n.includes('clear glass') ||
      n.includes('xtreme wheel') || n.includes('concentrate')) return 'ml'
  return 'unit'
}

// Convert liters to ml (1L = 1000ml) for liquid items
function convertQty(qty: number, unit: string): number {
  if (unit === 'ml') return qty * 1000  // L → ml
  return qty
}

async function main() {
  console.log('🚀 Seeding Prestige Garage database v2...\n')

  // ── 1. ROLLS ──────────────────────────────────────────
  console.log(`🎞️  Seeding ${seedData.rolls.length} rolls...`)
  for (const r of seedData.rolls) {
    const totalLen = toFloat(r.total_length)
    const price = toFloat(r.price)
    const consumptionsForRoll = seedData.consumptions.filter(c => c.roll_code === r.code)
    const consumed = consumptionsForRoll.reduce((sum, c) => sum + toFloat(c.meters_used) + toFloat(c.waste), 0)
    const remaining = Math.max(0, totalLen - consumed)
    let status = 'active'
    if (remaining <= 0) status = 'finished'
    else if (remaining <= 2) status = 'low'

    // Determine roll category: thermal_long, thermal_short, or ppf
    let rollCategory = 'ppf'
    const code = (r.code || '').toUpperCase()
    const type = (r.type || '').toLowerCase()
    if (type.includes('thermal') || type.includes('عزل') || code.includes('THL') || code.includes('THS')) {
      rollCategory = totalLen >= 15 ? 'thermal_long' : 'thermal_short'
    } else if (code.includes('THL')) {
      rollCategory = 'thermal_long'
    } else if (code.includes('THS')) {
      rollCategory = 'thermal_short'
    }

    // Count cars serviced from this roll
    const carsCount = consumptionsForRoll.filter(c => c.client_name).length

    await db.roll.upsert({
      where: { code: r.code },
      update: {},
      create: {
        code: r.code,
        brand: r.brand || '',
        type: r.type || '',
        model: r.model,
        width: r.width ? toFloat(r.width) : null,
        totalLength: totalLen,
        remainingLength: remaining,
        price,
        supplier: r.supplier,
        rollCategory,
        purchaseDate: toDate(r.purchase_date),
        notes: r.notes,
        status,
        carsCount,
      },
    })
  }

  // ── 2. ROLL CONSUMPTIONS ──────────────────────────────
  console.log(`✂️  Seeding ${seedData.consumptions.length} roll consumptions...`)
  for (const c of seedData.consumptions) {
    const roll = await db.roll.findUnique({ where: { code: c.roll_code || '' } })
    if (!roll) continue
    await db.rollConsumption.create({
      data: {
        rollId: roll.id,
        rollCode: roll.code,
        date: toDate(c.date) || new Date(),
        clientName: c.client_name,
        carType: c.car_type,
        plateNumber: c.plate_number,
        metersUsed: toFloat(c.meters_used),
        waste: toFloat(c.waste),
        usageArea: c.usage_area,
        workOrder: c.work_order,
        notes: c.notes,
        technician: null,
        transactionType: c.transaction_type || 'استهلاك',
      },
    })
  }

  // ── 3. EMPLOYEES ──────────────────────────────────────
  console.log(`👷 Seeding ${seedData.employees.length} employees...`)
  for (const e of seedData.employees) {
    await db.employee.upsert({
      where: { name: e.name },
      update: {},
      create: {
        name: e.name,
        baseSalary: toFloat(e.base_salary),
        phone: e.phone ? String(e.phone) : null,
        hireDate: toDate(e.hire_date),
        jobTitle: e.job_title,
        status: e.status || 'نشط',
        notes: e.notes,
      },
    })
  }

  // ── 4. ATTENDANCE (June 2026) ─────────────────────────
  console.log(`📅 Seeding ${seedData.attendance.length} attendance records...`)
  for (const a of seedData.attendance) {
    const emp = await db.employee.findUnique({ where: { name: a.employee_name } })
    if (!emp) continue
    const date = toDate(a.date)
    if (!date) continue
    await db.attendance.upsert({
      where: { employeeId_date: { employeeId: emp.id, date } },
      update: {},
      create: {
        employeeId: emp.id,
        employeeName: emp.name,
        date,
        status: a.status || 'غ',
        month: a.month || 6,
        year: a.year || 2026,
        notes: a.day_name,
      },
    })
  }

  // ── 5. ADVANCES ───────────────────────────────────────
  console.log(`💳 Seeding ${seedData.advances.length} advances...`)
  for (const adv of seedData.advances) {
    const emp = await db.employee.findUnique({ where: { name: adv.employee_name } })
    if (!emp) continue
    await db.advance.create({
      data: {
        employeeId: emp.id,
        employeeName: emp.name,
        date: toDate(adv.date) || new Date(),
        amount: toFloat(adv.amount),
        notes: adv.notes,
        month: adv.month || 0,
        year: adv.year || 0,
      },
    })
  }

  // ── 6. COMMISSIONS ────────────────────────────────────
  console.log(`🔧 Seeding ${seedData.commissions.length} commissions...`)
  for (const c of seedData.commissions) {
    const emp = await db.employee.findUnique({ where: { name: c.technician } })
    if (!emp) continue
    const dt = toDate(c.date) || new Date()
    await db.commission.create({
      data: {
        employeeId: emp.id,
        employeeName: emp.name,
        date: dt,
        month: dt.getMonth() + 1,
        year: dt.getFullYear(),
        monthLabel: c.month ? String(c.month) : null,
        clientName: c.client_name,
        carType: c.car_type,
        serviceType: c.service_type,
        serviceCategory: c.service_category,
        amount: toFloat(c.amount),
        notes: c.notes,
      },
    })
  }

  // ── 7. STOCK ITEMS — with name unification ────────────
  console.log(`📦 Seeding stock items (unified names)...`)
  const unifiedStock: Map<string, any> = new Map()
  for (const s of seedData.stock_items) {
    const canonicalName = unifyStockName(s.name, s.category || '')
    const category = categorizeStock(canonicalName, s.category || '')
    const unit = unifyUnit(canonicalName, s.unit || '')
    const totalReceived = convertQty(toFloat(s.total_received), unit)
    const totalWithdrawn = convertQty(toFloat(s.total_withdrawn), unit)
    const currentQty = convertQty(toFloat(s.current_qty), unit)
    const minLevel = convertQty(toFloat(s.min_level), unit)
    const unitPrice = toFloat(s.unit_price)

    if (unifiedStock.has(canonicalName)) {
      // Merge into existing
      const existing = unifiedStock.get(canonicalName)
      existing.totalReceived += totalReceived
      existing.totalWithdrawn += totalWithdrawn
      existing.currentQty += currentQty
      existing.unitPrice = Math.max(existing.unitPrice, unitPrice)
    } else {
      unifiedStock.set(canonicalName, {
        name: canonicalName,
        category,
        unit,
        totalReceived,
        totalWithdrawn,
        currentQty,
        minLevel,
        unitPrice,
      })
    }
  }

  for (const [, item] of unifiedStock) {
    let status = 'كافي'
    if (item.currentQty <= 0) status = 'نفد'
    else if (item.currentQty < item.minLevel) status = 'منخفض'

    await db.stockItem.create({
      data: {
        name: item.name,
        category: item.category,
        unit: item.unit,
        totalReceived: item.totalReceived,
        totalWithdrawn: item.totalWithdrawn,
        currentQty: item.currentQty,
        minLevel: item.minLevel,
        status,
        unitPrice: item.unitPrice,
      },
    })
  }
  console.log(`   ✓ Unified to ${unifiedStock.size} unique items`)

  // ── 8. STOCK MOVEMENTS ────────────────────────────────
  console.log(`🔄 Seeding ${seedData.stock_movements.length} stock movements...`)
  for (const m of seedData.stock_movements) {
    const canonicalName = unifyStockName(m.item_name || '', m.material_type || '')
    const item = await db.stockItem.findUnique({ where: { name: canonicalName } })
    const unit = item?.unit || unifyUnit(canonicalName, m.unit || '')
    const qty = convertQty(toFloat(m.quantity), unit)
    await db.stockMovement.create({
      data: {
        itemId: item?.id || null,
        itemName: canonicalName,
        date: toDate(m.date) || new Date(),
        materialType: m.material_type,
        movementType: m.movement_type || 'استلام',
        quantity: qty,
        unit,
        unitPrice: toFloat(m.unit_price),
        totalCost: toFloat(m.total_cost),
        notes: m.notes,
        deliveryNote: m.delivery_note ? String(m.delivery_note) : null,
      },
    })
  }

  // ── 9. SERVICES ───────────────────────────────────────
  console.log(`🔧 Seeding ${seedData.services.length} services...`)
  for (const sv of seedData.services) {
    await db.service.create({
      data: {
        code: sv.code,
        date: toDate(sv.date) || new Date(),
        plate: sv.plate ? String(sv.plate) : null,
        clientName: sv.client_name,
        carType: sv.car_type,
        serviceType: sv.service_type || 'أخرى',
        serviceCategory: sv.service_type,
        price: toFloat(sv.price),
        paymentMethod: sv.payment_method,
        technician: sv.technician,
        notes: sv.notes,
      },
    })
  }

  // ── 10. INVOICES ──────────────────────────────────────
  console.log(`🧾 Seeding ${seedData.invoices.length} invoices...`)
  for (const inv of seedData.invoices) {
    await db.invoice.create({
      data: {
        deliveryNote: inv.delivery_note,
        date: toDate(inv.date),
        description: inv.description,
        total: toFloat(inv.total),
        discount: toFloat(inv.discount),
        net: toFloat(inv.net),
        itemsCount: inv.items_count || 0,
        notes: inv.notes,
      },
    })
  }

  // ── 11. AUTO-GENERATE ALERTS ──────────────────────────
  console.log(`🔔 Generating smart alerts...`)
  const lowRolls = await db.roll.findMany({ where: { status: { in: ['low', 'finished'] } } })
  for (const r of lowRolls) {
    await db.alert.create({
      data: {
        type: 'roll_low',
        severity: r.status === 'finished' ? 'critical' : 'warning',
        title: `رول ${r.code} ${r.status === 'finished' ? 'منتهي' : 'أوشك على النفاذ'}`,
        message: `الرول ${r.brand} ${r.type} (${r.code}) — المتبقي ${(r.remainingLength || 0).toFixed(2)} متر`,
        relatedId: r.id,
        relatedType: 'roll',
      },
    })
  }

  const lowStock = await db.stockItem.findMany({ where: { status: { in: ['منخفض', 'نفد'] } } })
  for (const s of lowStock) {
    await db.alert.create({
      data: {
        type: 'low_stock',
        severity: s.status === 'نفد' ? 'critical' : 'warning',
        title: `مخزون ${s.name} ${s.status}`,
        message: `الصنف ${s.name} (${s.category}) — الكمية الحالية ${s.currentQty} ${s.unit}`,
        relatedId: s.id,
        relatedType: 'stock_item',
      },
    })
  }

  // ── SUMMARY ───────────────────────────────────────────
  const counts = {
    rolls: await db.roll.count(),
    consumptions: await db.rollConsumption.count(),
    employees: await db.employee.count(),
    attendance: await db.attendance.count(),
    advances: await db.advance.count(),
    commissions: await db.commission.count(),
    stockItems: await db.stockItem.count(),
    stockMovements: await db.stockMovement.count(),
    services: await db.service.count(),
    invoices: await db.invoice.count(),
    alerts: await db.alert.count(),
  }
  console.log('\n✅ Seed complete! Counts:')
  console.table(counts)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
