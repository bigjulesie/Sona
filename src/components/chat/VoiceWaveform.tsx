'use client'

import { useEffect, useRef } from 'react'

interface Props {
  analyser: AnalyserNode | null
}

const BAR_COUNT = 7

export function VoiceWaveform({ analyser }: Props) {
  const barRefs = useRef<(HTMLDivElement | null)[]>([])
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    if (!analyser) {
      barRefs.current.forEach((el) => el && (el.style.height = '4px'))
      return
    }

    const data = new Uint8Array(analyser.frequencyBinCount)
    const step = Math.floor(data.length / BAR_COUNT)
    const node = analyser

    function tick() {
      node.getByteFrequencyData(data)
      for (let i = 0; i < BAR_COUNT; i++) {
        const value = data[i * step] / 255
        const height = Math.max(4, Math.round(value * 28))
        const el = barRefs.current[i]
        if (el) el.style.height = `${height}px`
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [analyser])

  return (
    <div className="flex items-center gap-[3px] h-8" aria-hidden>
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <div
          key={i}
          ref={(el) => { barRefs.current[i] = el }}
          className="w-[3px] rounded-full bg-current"
          style={{ height: '4px', transition: 'none' }}
        />
      ))}
    </div>
  )
}
