import { NextRequest, NextResponse } from 'next/server'
import { confirmAndExecuteTool } from '@/lib/ai-assistant'
import { AI_TOOLS } from '@/lib/ai-tools'
import { firewall, applySecurityHeaders, sanitizeInput } from '@/lib/firewall'
import { getSessionUser } from '@/lib/auth'

const VALID_TOOL_NAMES = new Set(AI_TOOLS.map(t => t.function.name))

// POST /api/ai/confirm — executes a tool call the user has explicitly confirmed
// in the chat UI. This is the ONLY place actual database writes happen for the
// AI assistant — the /api/ai/chat route only ever proposes actions.
export async function POST(req: NextRequest) {
  const check = await firewall(req)
  if (check.blocked) return check.response!

  try {
    // middleware already guarantees a valid session for every /api/* route,
    // so this is just reading the identity to attach to accountable actions
    // (e.g. pay_salary) — same identity the manual /api/payroll/pay route uses.
    const user = await getSessionUser(req)

    const rawBody = await req.json()
    const body = sanitizeInput(rawBody)
    const tool = typeof body.tool === 'string' ? body.tool : ''
    const args = body.args && typeof body.args === 'object' ? body.args : {}

    if (!tool || !VALID_TOOL_NAMES.has(tool)) {
      const r = NextResponse.json({ error: 'أداة غير صالحة', code: 'INVALID_TOOL' }, { status: 400 })
      return applySecurityHeaders(r)
    }

    const result = await confirmAndExecuteTool(tool, args, user ? { userId: user.id, userName: user.name } : undefined)

    const r = NextResponse.json({
      success: result.success,
      reply: result.message,
      data: result.data,
      timestamp: new Date().toISOString(),
    }, { status: result.success ? 200 : 400 })
    return applySecurityHeaders(r)
  } catch (e: any) {
    console.error('AI confirm API error:', e)
    const r = NextResponse.json({ error: 'حدث خطأ', code: 'INTERNAL_ERROR' }, { status: 500 })
    return applySecurityHeaders(r)
  }
}
