// Stub audit logger — no-op in this repo (full version writes to AuditLog table)
export async function logAudit(entry: {
  action: string
  tableName: string
  recordId?: string | null
  newValue?: any
  source?: string
  userId?: string | null
  userName?: string | null
}): Promise<void> {
  // No-op — audit logging disabled in this repo
  console.log('[audit]', entry.action, entry.tableName, entry.recordId || '')
}
