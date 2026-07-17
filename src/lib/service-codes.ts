// Stub for service-codes — generates service code from service type
// (full implementation in the main ai-os repo)
export async function generateServiceCode(serviceType: string | null | undefined): Promise<string> {
  const prefix = getServicePrefix(serviceType)
  // Simple sequence based on count — full repo uses max+1 per prefix
  const { db } = await import('@/lib/db')
  const count = await db.service.count()
  return `${prefix}${String(count + 1).padStart(3, '0')}`
}

export function getServicePrefix(serviceType: string | null | undefined): string {
  const t = (serviceType || '').toLowerCase()
  if (t.includes('عزل') || t.includes('thermal') || t.includes('thf')) return 'THF'
  if (t.includes('فاميه') || t.includes('thv')) return 'THV'
  if (t.includes('بوليش') || t.includes('polish') || t.includes('تلميع')) return 'POL'
  if (t.includes('نانو') || t.includes('nano') || t.includes('ceramic')) return 'NNO'
  if (t.includes('ديتيلنج') || t.includes('detail')) return 'DET'
  if (t.includes('بروتيكشن') || t.includes('protection') || t.includes('ppf') || t.includes('حماية')) return 'PPF'
  return 'OTH'
}
