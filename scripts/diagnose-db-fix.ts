/**
 * DB-FIX Diagnostic Script (READ-ONLY)
 * Queries the production DB to diagnose:
 *   1. SOL-WHT-001 state (balance, status, consumptions)
 *   2. OB-0019 (is it for 3M-SG-001 or SOL-WHT-001?)
 *   3. All OBX consumptions (to verify max OBX number)
 *   4. Sanity: list all rolls, list all consumptions count
 *
 * NOTE: Prisma + Postgres uses camelCase column names (no @map per field).
 */
import pg from 'pg'

const CONN = 'postgresql://neondb_owner:npg_NxWCpFb57zdo@ep-mute-mode-aofl1hk7-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'

async function main() {
  const client = new pg.Client({ connectionString: CONN, ssl: { rejectUnauthorized: false } })
  await client.connect()
  console.log('✅ Connected to DB\n')

  // ─────────────── 1) SOL-WHT-001 roll state ───────────────
  console.log('══════════════ 1) SOL-WHT-001 ROLL STATE ══════════════')
  const solRoll = await client.query(`
    SELECT id, code, brand, type, model, "totalLength", "remainingLength", status, "carsCount", "createdAt"
    FROM rolls
    WHERE code = 'SOL-WHT-001'
  `)
  console.table(solRoll.rows)

  // ─────────────── 2) All consumptions for SOL-WHT-001 ───────────────
  console.log('\n══════════════ 2) ALL CONSUMPTIONS FOR SOL-WHT-001 ══════════════')
  const solCons = await client.query(`
    SELECT id, "rollCode", date, "clientName", "carType", "metersUsed", waste, "workOrder", "transactionType", notes, "createdAt"
    FROM roll_consumptions
    WHERE "rollCode" = 'SOL-WHT-001'
    ORDER BY date DESC
  `)
  console.log(`Count: ${solCons.rowCount}`)
  console.table(solCons.rows)

  // ─────────────── 3) OB-0019 — which roll? ───────────────
  console.log('\n══════════════ 3) OB-0019 — WHICH ROLL? ══════════════')
  const ob0019 = await client.query(`
    SELECT id, "rollCode", date, "clientName", "carType", "plateNumber", "metersUsed", waste, "workOrder", "transactionType", notes, technician, "createdAt"
    FROM roll_consumptions
    WHERE "workOrder" ILIKE 'OB-0019' OR "workOrder" ILIKE 'OB0019' OR "workOrder" ILIKE 'OB 0019' OR "workOrder" ILIKE '%0019%'
    ORDER BY date DESC
  `)
  console.log(`Count: ${ob0019.rowCount}`)
  console.table(ob0019.rows)

  // ─────────────── 4) All OBX consumptions + max OBX number ───────────────
  console.log('\n══════════════ 4) ALL OBX CONSUMPTIONS ══════════════')
  const obxAll = await client.query(`
    SELECT id, "rollCode", date, "clientName", "carType", "metersUsed", waste, "workOrder", "transactionType", notes, "createdAt"
    FROM roll_consumptions
    WHERE "workOrder" ILIKE 'OBX%'
    ORDER BY date DESC
  `)
  console.log(`OBX count: ${obxAll.rowCount}`)
  console.table(obxAll.rows)

  // Max OBX number extracted
  const obxNums = obxAll.rows
    .map((r: any) => {
      const m = (r.workOrder || '').match(/OBX[-\s]*(\d+)/i)
      return m ? parseInt(m[1], 10) : null
    })
    .filter((n: number | null): n is number => n !== null)
  console.log(`OBX numbers found: ${JSON.stringify(obxNums)}`)
  console.log(`Max OBX number: ${obxNums.length ? Math.max(...obxNums) : 0}`)

  // ─────────────── 5) All OB-XXXX consumptions (regular) + max ───────────────
  console.log('\n══════════════ 5) ALL OB-XXXX CONSUMPTIONS (regular) ══════════════')
  const obAll = await client.query(`
    SELECT "workOrder", "rollCode", "clientName", "carType", "metersUsed", waste, date
    FROM roll_consumptions
    WHERE "workOrder" ILIKE 'OB-%' OR "workOrder" ILIKE 'OB%'
    ORDER BY date DESC
    LIMIT 100
  `)
  console.log(`Total OB-ish count (top 100): ${obAll.rowCount}`)
  console.table(obAll.rows)

  const obNums = obAll.rows
    .map((r: any) => {
      // Match OB-XXXX where XXXX is purely numeric, NOT OBX
      const m = (r.workOrder || '').match(/^OB-?(\d+)$/i)
      return m ? parseInt(m[1], 10) : null
    })
    .filter((n: number | null): n is number => n !== null)
  console.log(`Regular OB numbers: ${JSON.stringify(obNums)}`)
  console.log(`Max OB number: ${obNums.length ? Math.max(...obNums) : 0}`)

  // ─────────────── 6) Total consumptions + work_order distribution ───────────────
  console.log('\n══════════════ 6) WORK_ORDER DISTRIBUTION ══════════════')
  const woDist = await client.query(`
    SELECT 
      CASE 
        WHEN "workOrder" IS NULL THEN 'NULL'
        WHEN "workOrder" ILIKE 'OBX%' THEN 'OBX%'
        WHEN "workOrder" ILIKE 'OB-%' THEN 'OB-XXXX'
        WHEN "workOrder" ILIKE 'OB%' THEN 'OBXXXX (no dash)'
        ELSE 'OTHER'
      END AS wo_pattern,
      COUNT(*) AS cnt
    FROM roll_consumptions
    GROUP BY wo_pattern
    ORDER BY cnt DESC
  `)
  console.table(woDist.rows)

  const totalCons = await client.query(`SELECT COUNT(*) AS total FROM roll_consumptions`)
  console.log(`Total consumptions in DB: ${totalCons.rows[0].total}`)

  // ─────────────── 7) All rolls overview ───────────────
  console.log('\n══════════════ 7) ALL ROLLS OVERVIEW ══════════════')
  const allRolls = await client.query(`
    SELECT code, brand, type, "totalLength", "remainingLength", status, "carsCount"
    FROM rolls
    ORDER BY code
  `)
  console.table(allRolls.rows)

  // ─────────────── 8) Find any consumption mentioning Lynk / Ramy ───────────────
  console.log('\n══════════════ 8) CONSUMPTIONS MENTIONING RAMY/LYNK & CO ══════════════')
  const lynk = await client.query(`
    SELECT id, "rollCode", date, "clientName", "carType", "metersUsed", waste, "workOrder", "transactionType", notes, "createdAt"
    FROM roll_consumptions
    WHERE "clientName" ILIKE '%ramy%'
       OR "clientName" ILIKE '%رامي%'
       OR "carType" ILIKE '%lynk%'
       OR "carType" ILIKE '%لينك%'
       OR notes ILIKE '%lynk%'
       OR notes ILIKE '%لينك%'
       OR notes ILIKE '%ramy%'
       OR notes ILIKE '%رامي%'
    ORDER BY date DESC
  `)
  console.log(`Count: ${lynk.rowCount}`)
  console.table(lynk.rows)

  // ─────────────── 9) Find consumptions for 3M-SG-001 ───────────────
  console.log('\n══════════════ 9) CONSUMPTIONS FOR 3M-SG-001 ══════════════')
  const m3sg = await client.query(`
    SELECT id, "rollCode", date, "clientName", "carType", "metersUsed", waste, "workOrder", "transactionType", notes, "createdAt"
    FROM roll_consumptions
    WHERE "rollCode" = '3M-SG-001'
    ORDER BY date DESC
  `)
  console.log(`Count: ${m3sg.rowCount}`)
  console.table(m3sg.rows)

  await client.end()
  console.log('\n✅ Done')
}

main().catch(e => { console.error('❌', e); process.exit(1) })
