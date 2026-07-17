import { NextRequest, NextResponse } from 'next/server'

// GET /api/ai/test — debug endpoint to test each AI provider
export async function GET(req: NextRequest) {
  const results: any = {}

  // Test 1: OpenRouter (lm5)
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY || 'MISSING'}`,
        'HTTP-Referer': 'https://prestige-garage-internal.vercel.app',
        'X-Title': 'Prestige Garage',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.3-70b-instruct',
        messages: [{ role: 'user', content: 'say ok' }],
        max_tokens: 5,
      }),
    })
    const text = await res.text()
    results.openrouter = {
      status: res.status,
      keyPresent: !!process.env.OPENROUTER_API_KEY,
      keyPrefix: (process.env.OPENROUTER_API_KEY || '').substring(0, 15),
      response: text.substring(0, 300),
    }
  } catch (e: any) {
    results.openrouter = { error: e.message, keyPresent: !!process.env.OPENROUTER_API_KEY }
  }

  // Test 2: Groq
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY || 'MISSING'}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: 'say ok' }],
        max_tokens: 5,
      }),
    })
    results.groq = { status: res.status, keyPresent: !!process.env.GROQ_API_KEY, response: (await res.text()).substring(0, 200) }
  } catch (e: any) {
    results.groq = { error: e.message }
  }

  // Test 3: Z-AI SDK
  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const ai = await ZAI.create()
    const response = await ai.chat.completions.create({
      messages: [{ role: 'user', content: 'say ok' }],
      temperature: 0.2,
      max_tokens: 5,
    })
    results.zai = { ok: true, reply: response.choices[0]?.message?.content?.substring(0, 100) }
  } catch (e: any) {
    results.zai = { error: e.message }
  }

  return NextResponse.json(results, { status: 200 })
}
