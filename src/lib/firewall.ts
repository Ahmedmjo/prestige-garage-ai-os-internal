/**
 * 🔒 Prestige Garage Firewall — Multi-layer Security System
 */
import { NextResponse } from 'next/server'

const CONFIG = {
  RATE_LIMIT_MAX: 100,
  RATE_LIMIT_WINDOW_MS: 60_000,
  RATE_LIMIT_STRICT_MAX: 20,
  RATE_LIMIT_STRICT_WINDOW_MS: 60_000,
  MAX_BODY_SIZE: 1024 * 1024,
  IP_BLACKLIST: new Set<string>(),
  BLOCKED_USER_AGENTS: [
    'sqlmap', 'nikto', 'nmap', 'masscan', 'dirb', 'gobuster',
    'wpscan', 'hydra', 'burp', 'owasp', 'zap', 'acunetix',
  ],
  SQL_INJECTION_PATTERNS: [
    /(\bunion\b|\bselect\b|\binsert\b|\bupdate\b|\bdelete\b|\bdrop\b).*(\bfrom\b|\binto\b|\btable\b)/i,
    /'.*OR.*'.*=.*'/i, /;\s*(drop|delete|update)\s/i, /--\s*$/m,
  ],
  XSS_PATTERNS: [
    /<script[^>]*>.*?<\/script>/gi, /javascript:\s*[^,]/i,
    /on(load|error|click)\s*=/i, /eval\s*\(/i,
  ],
  PATH_TRAVERSAL_PATTERNS: [/\.\.\//, /etc\/passwd/i],
}

interface RateLimitEntry { count: number; strictCount: number; resetTime: number; strictResetTime: number; }
const rateLimitStore = new Map<string, RateLimitEntry>()

setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime && now > entry.strictResetTime) rateLimitStore.delete(ip)
  }
}, 5 * 60 * 1000)

function checkRateLimit(ip: string, isStrict: boolean): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now()
  let entry = rateLimitStore.get(ip)
  if (!entry) {
    entry = { count: 0, strictCount: 0, resetTime: now + CONFIG.RATE_LIMIT_WINDOW_MS, strictResetTime: now + CONFIG.RATE_LIMIT_STRICT_WINDOW_MS }
    rateLimitStore.set(ip, entry)
  }
  if (now > entry.resetTime) { entry.count = 0; entry.resetTime = now + CONFIG.RATE_LIMIT_WINDOW_MS }
  if (now > entry.strictResetTime) { entry.strictCount = 0; entry.strictResetTime = now + CONFIG.RATE_LIMIT_STRICT_WINDOW_MS }

  if (isStrict) {
    entry.strictCount++
    if (entry.strictCount > CONFIG.RATE_LIMIT_STRICT_MAX) return { allowed: false, remaining: 0, resetIn: Math.ceil((entry.strictResetTime - now) / 1000) }
    return { allowed: true, remaining: CONFIG.RATE_LIMIT_STRICT_MAX - entry.strictCount, resetIn: Math.ceil((entry.strictResetTime - now) / 1000) }
  }
  entry.count++
  if (entry.count > CONFIG.RATE_LIMIT_MAX) return { allowed: false, remaining: 0, resetIn: Math.ceil((entry.resetTime - now) / 1000) }
  return { allowed: true, remaining: CONFIG.RATE_LIMIT_MAX - entry.count, resetIn: Math.ceil((entry.resetTime - now) / 1000) }
}

function getClientIP(req: Request): string {
  return req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}

function detectThreats(input: string): { detected: boolean; type: string } {
  for (const p of CONFIG.SQL_INJECTION_PATTERNS) if (p.test(input)) return { detected: true, type: 'SQL_INJECTION' }
  for (const p of CONFIG.XSS_PATTERNS) if (p.test(input)) return { detected: true, type: 'XSS' }
  for (const p of CONFIG.PATH_TRAVERSAL_PATTERNS) if (p.test(input)) return { detected: true, type: 'PATH_TRAVERSAL' }
  return { detected: false, type: '' }
}

function isBotScanner(ua: string): boolean {
  const u = ua.toLowerCase()
  return CONFIG.BLOCKED_USER_AGENTS.some(b => u.includes(b))
}

export function sanitizeInput(input: any): any {
  if (typeof input === 'string') return input.replace(/<script[^>]*>.*?<\/script>/gi, '').replace(/<[^>]+>/g, '').replace(/javascript:/gi, '').trim().slice(0, 10000)
  if (Array.isArray(input)) return input.map(sanitizeInput)
  if (input && typeof input === 'object') {
    const s: any = {}
    for (const [k, v] of Object.entries(input)) { if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue; s[k] = sanitizeInput(v) }
    return s
  }
  return input
}

export function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  response.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  return response
}

export interface FirewallResult { blocked: boolean; response?: NextResponse; ip: string; reason?: string }

export async function firewall(req: Request): Promise<FirewallResult> {
  const ip = getClientIP(req)
  const method = req.method.toUpperCase()
  const ua = req.headers.get('user-agent') || ''
  const url = new URL(req.url)

  if (CONFIG.IP_BLACKLIST.has(ip)) return { blocked: true, ip, reason: 'IP blacklisted', response: NextResponse.json({ error: 'Access denied', code: 'IP_BLOCKED' }, { status: 403 }) }
  if (isBotScanner(ua)) return { blocked: true, ip, reason: 'Bot detected', response: NextResponse.json({ error: 'Access denied', code: 'BOT_DETECTED' }, { status: 403 }) }

  const isStrict = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
  const rc = checkRateLimit(ip, isStrict)
  if (!rc.allowed) return { blocked: true, ip, reason: 'Rate limited', response: NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED', retryAfter: rc.resetIn }, { status: 429, headers: { 'Retry-After': String(rc.resetIn) } }) }

  const ut = detectThreats(url.pathname + url.search)
  if (ut.detected) return { blocked: true, ip, reason: ut.type, response: NextResponse.json({ error: 'Invalid request', code: ut.type }, { status: 400 }) }

  const cl = parseInt(req.headers.get('content-length') || '0')
  if (cl > CONFIG.MAX_BODY_SIZE) return { blocked: true, ip, reason: 'Body too large', response: NextResponse.json({ error: 'Body too large', code: 'BODY_TOO_LARGE' }, { status: 413 }) }

  if (['POST', 'PUT', 'PATCH'].includes(method) && cl > 0) {
    try {
      const cloned = req.clone()
      const body = await cloned.json()
      const bt = detectThreats(JSON.stringify(body))
      if (bt.detected) return { blocked: true, ip, reason: bt.type, response: NextResponse.json({ error: 'Invalid input', code: bt.type }, { status: 400 }) }
    } catch {}
  }

  return { blocked: false, ip }
}

export function blockIP(ip: string) { CONFIG.IP_BLACKLIST.add(ip) }
export function unblockIP(ip: string) { CONFIG.IP_BLACKLIST.delete(ip) }
export function getBlockedIPs(): string[] { return Array.from(CONFIG.IP_BLACKLIST) }
export function getRateLimitStats() { return { totalTrackedIPs: rateLimitStore.size } }
