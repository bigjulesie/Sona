import { describe, it, expect } from 'vitest'
import { detectBrand, isSonaPublicRoute } from '@/middleware'

describe('detectBrand', () => {
  it('returns nh for neuralheirloom.com', () => {
    expect(detectBrand('neuralheirloom.com')).toBe('nh')
  })

  it('returns sona for entersona.com', () => {
    expect(detectBrand('entersona.com')).toBe('sona')
  })

  it('returns BRAND env var for localhost', () => {
    process.env.BRAND = 'sona'
    expect(detectBrand('localhost:3000')).toBe('sona')
    delete process.env.BRAND
  })

  it('defaults to nh when BRAND unset', () => {
    delete process.env.BRAND
    expect(detectBrand('localhost:3000')).toBe('nh')
  })
})

describe('isSonaPublicRoute', () => {
  it('allows /explore', () => expect(isSonaPublicRoute('/explore')).toBe(true))
  it('allows /sona/john-doe', () => expect(isSonaPublicRoute('/sona/john-doe')).toBe(true))
  it('allows /signup', () => expect(isSonaPublicRoute('/signup')).toBe(true))
  it('blocks /dashboard', () => expect(isSonaPublicRoute('/dashboard')).toBe(false))
  it('blocks /account', () => expect(isSonaPublicRoute('/account')).toBe(false))
})
