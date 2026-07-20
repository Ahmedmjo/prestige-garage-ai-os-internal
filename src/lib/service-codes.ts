// Stub for service-codes — generates service code from service type
// Pattern: PREFIX + 3-digit sequence (DET001, THF001, POL001, NNO001, THV001, PPF001, OTH001)
import { db } from '@/lib/db'

export async function generateServiceCode(serviceType: string | null | undefined): Promise<string> {
  const prefix = getServicePrefix(serviceType)
  // Find the max sequence number for this prefix from existing services
  const services = await db.service.findMany({
    where: { code: { startsWith: prefix } },
    select: { code: true },
  })
  let maxNum = 0
  for (const s of services) {
    const match = s.code?.match(new RegExp(`^${prefix}(\\d+)$`))
    if (match) {
      const n = parseInt(match[1], 10)
      if (n > maxNum) maxNum = n
    }
  }
  return `${prefix}${String(maxNum + 1).padStart(3, '0')}`
}

export function getServicePrefix(serviceType: string | null | undefined): string {
  const t = (serviceType || '').toLowerCase()
  if (t.includes('عزل') || t.includes('thermal') || t.includes('thf')) return 'THF'
  if (t.includes('فاميه') || t.includes('thv') || t.includes('إزالة فاميه')) return 'THV'
  if (t.includes('بوليش') || t.includes('polish') || t.includes('تلميع')) return 'POL'
  if (t.includes('نانو') || t.includes('nano') || t.includes('ceramic')) return 'NNO'
  if (t.includes('ديتيلنج') || t.includes('دتيلنج') || t.includes('detail')) return 'DET'
  if (t.includes('بروتيكشن') || t.includes('protection') || t.includes('ppf') || t.includes('حماية')) return 'PPF'
  return 'OTH'
}
