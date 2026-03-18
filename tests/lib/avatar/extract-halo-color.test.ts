// tests/lib/avatar/extract-halo-color.test.ts
import { describe, it, expect } from 'vitest'
import { extractHaloColor } from '@/lib/avatar/extract-halo-color'

// Mock canvas for Node environment
function makeCanvas(pixels: [number, number, number][]): HTMLCanvasElement {
  const size = Math.sqrt(pixels.length)
  const imageData = new Uint8ClampedArray(pixels.flatMap(([r, g, b]) => [r, g, b, 255]))
  return {
    width: size,
    height: size,
    getContext: () => ({
      getImageData: () => ({ data: imageData, width: size, height: size }),
    }),
  } as unknown as HTMLCanvasElement
}

describe('extractHaloColor', () => {
  it('returns the most saturated non-white non-black pixel as hex', () => {
    // 4 pixels: coral, white, black, grey
    const canvas = makeCanvas([
      [222, 62, 123],  // coral — should win
      [250, 250, 250], // near-white — skipped
      [10, 10, 10],    // near-black — skipped
      [128, 128, 128], // grey — low saturation
    ])
    expect(extractHaloColor(canvas)).toBe('#de3e7b')
  })

  it('returns a fallback grey when all pixels are near-white or near-black', () => {
    // Must be a perfect square (2×2 = 4 pixels) so canvas width/height are integers
    const canvas = makeCanvas([
      [240, 240, 240],
      [15,  15,  15],
      [240, 240, 240],
      [15,  15,  15],
    ])
    expect(extractHaloColor(canvas)).toBe('#b0b0b0')
  })
})
