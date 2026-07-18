import { NextResponse } from 'next/server'

export async function GET() {
  const results: any = {}
  
  // Test Gemini
  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-goog-api-key': process.env.GEMINI_API_KEY || 'MISSING' },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'say ok' }] }], generationConfig: { maxOutputTokens: 5 } }),
    })
    const text = await res.text()
    results.gemini = { status: res.status, response: text.substring(0, 200) }
  } catch (e: any) { results.gemini = { error: e.message } }

  // Test OpenRouter
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`, 'HTTP-Referer': 'https://prestige-garage-internal.vercel.app', 'X-Title': 'Test' },
      body: JSON.stringify({ model: 'meta-llama/llama-3.3-70b-instruct', messages: [{ role: 'user', content: 'say ok' }], max_tokens: 5 }),
    })
    const text = await res.text()
    results.openrouter = { status: res.status, response: text.substring(0, 200) }
  } catch (e: any) { results.openrouter = { error: e.message } }

  return NextResponse.json(results)
}
