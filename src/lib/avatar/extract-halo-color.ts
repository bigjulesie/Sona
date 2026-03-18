/**
 * Sample a 10×10 grid across the canvas, skip near-white/near-black pixels,
 * and return the most saturated remaining pixel as a CSS hex string.
 * Falls back to #b0b0b0 if no usable pixels are found.
 */
export function extractHaloColor(canvas: HTMLCanvasElement): string {
  const ctx = canvas.getContext('2d')
  if (!ctx) return '#b0b0b0'

  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const stepX = Math.max(1, Math.floor(width / 10))
  const stepY = Math.max(1, Math.floor(height / 10))

  let bestR = 176, bestG = 176, bestB = 176
  let bestSaturation = -1

  for (let y = 0; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      const i = (y * width + x) * 4
      const r = data[i], g = data[i + 1], b = data[i + 2]

      // Skip near-white
      if (r > 230 && g > 230 && b > 230) continue
      // Skip near-black
      if (r < 25 && g < 25 && b < 25) continue

      // HSL saturation approximation
      const max = Math.max(r, g, b) / 255
      const min = Math.min(r, g, b) / 255
      const saturation = max === 0 ? 0 : (max - min) / max

      if (saturation > bestSaturation) {
        bestSaturation = saturation
        bestR = r; bestG = g; bestB = b
      }
    }
  }

  return `#${bestR.toString(16).padStart(2, '0')}${bestG.toString(16).padStart(2, '0')}${bestB.toString(16).padStart(2, '0')}`
}
