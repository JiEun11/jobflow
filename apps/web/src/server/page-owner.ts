import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { ownerId } from './auth'

export async function pageOwner() {
  const principal = await ownerId(await headers())
  if (!principal) redirect('/login')
  return principal
}
