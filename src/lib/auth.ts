// Stub auth — middleware handles session protection.
// This returns null user (AI actions run without user identity attribution
// in this repo; full version in ai-os repo links to Employee/User).
import { NextRequest } from 'next/server'

export async function getSessionUser(req: NextRequest): Promise<{ id: string; name: string } | null> {
  return null
}
