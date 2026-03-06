import { headers } from 'next/headers'
import { detectBrand } from '@/proxy'

export async function getBrand() {
  const h = await headers()
  const host = h.get('host') ?? ''
  return detectBrand(host)
}
