import { headers } from 'next/headers'
import type { Brand } from '@/middleware'

export async function getBrand(): Promise<Brand> {
  const h = await headers()
  const brand = h.get('x-brand')
  return brand === 'sona' ? 'sona' : 'nh'
}
