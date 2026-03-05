import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{
      width: 180,
      height: 180,
      background: '#ffffff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        width: 130,
        height: 130,
        borderRadius: '50%',
        background: 'radial-gradient(circle, #DE3E7B 0%, #DE3E7B 49%, #ffffff 100%)',
      }} />
    </div>,
    { ...size }
  )
}
