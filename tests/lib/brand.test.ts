import { describe, it, expect, vi } from 'vitest'

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}))

import { getBrand } from '@/lib/brand'
import { headers } from 'next/headers'

describe('getBrand', () => {
  it('returns nh when x-brand is nh', async () => {
    vi.mocked(headers).mockResolvedValue({ get: (k: string) => k === 'x-brand' ? 'nh' : null } as any)
    expect(await getBrand()).toBe('nh')
  })

  it('returns sona when x-brand is sona', async () => {
    vi.mocked(headers).mockResolvedValue({ get: (k: string) => k === 'x-brand' ? 'sona' : null } as any)
    expect(await getBrand()).toBe('sona')
  })

  it('defaults to nh when header missing', async () => {
    vi.mocked(headers).mockResolvedValue({ get: () => null } as any)
    expect(await getBrand()).toBe('nh')
  })
})
