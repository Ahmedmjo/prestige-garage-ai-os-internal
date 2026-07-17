import { NextRequest, NextResponse } from 'next/server'
import { chatWithAssistant } from '@/lib/ai-assistant'

export async function GET(req: NextRequest) {
  try {
    const result: any = await chatWithAssistant('مرحبا، كيف حالك؟', [])
    return NextResponse.json({
      reply: result.reply?.substring(0, 200),
      provider: result.provider,
      intent: result.intent,
      errors: result.errors || 'no errors field',
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message, stack: e.stack?.substring(0, 500) })
  }
}
