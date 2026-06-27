import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const requestCounts = new Map<string, { count: number; resetTime: number }>()
const WINDOW_MS = 60_000
const MAX_REQUESTS = 120
const BLOCKED_UA = ['sqlmap', 'nikto', 'nmap', 'masscan', 'dirb', 'gobuster', 'wpscan', 'hydra', 'burp', 'owasp', 'zap', 'acunetix']

export function middleware(req: NextRequest) {
  const ip = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const ua = (req.headers.get('user-agent') || '').toLowerCase()
  const now = Date.now()

  if (BLOCKED_UA.some(b => ua.includes(b))) {
    return new NextResponse(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
  }

  let entry = requestCounts.get(ip)
  if (!entry || now > entry.resetTime) { entry = { count: 0, resetTime: now + WINDOW_MS }; requestCounts.set(ip, entry) }
  entry.count++

  if (entry.count > MAX_REQUESTS) {
    return new NextResponse(JSON.stringify({ error: 'Too many requests' }), { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } })
  }

  const response = NextResponse.next()
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  response.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")
  response.headers.set('X-RateLimit-Limit', String(MAX_REQUESTS))
  response.headers.set('X-RateLimit-Remaining', String(Math.max(0, MAX_REQUESTS - entry.count)))
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|prestige-brand-logo.png|robots.txt|logo.svg).*)'],
}
