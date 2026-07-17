import { NextRequest, NextResponse } from 'next/server'
import { chatWithAssistant } from '@/lib/ai-assistant'

// POST /api/ai/chat — chat with Prestige AI Assistant
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { message, history = [] } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'الرسالة مطلوبة' }, { status: 400 })
    }

    const result = await chatWithAssistant(message, history)

    return NextResponse.json({
      reply: result.reply,
      intent: result.intent,
      provider: result.provider || '',
      pendingAction: (result as any).pendingAction || null,
      timestamp: new Date().toISOString(),
    })
  } catch (e: any) {
    console.error('AI chat API error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET /api/ai/chat — get conversation history
export async function GET() {
  try {
    const { db } = await import('@/lib/db')
    const conversations = await db.aiConversation.findMany({
      orderBy: { timestamp: 'desc' },
      take: 50,
    })
    return NextResponse.json(conversations)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
