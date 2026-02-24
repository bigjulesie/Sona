import type { Metadata } from 'next'
import { Cormorant_Garamond, Lora } from 'next/font/google'
import './globals.css'

const cormorant = Cormorant_Garamond({
  variable: '--font-cormorant',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
})

const lora = Lora({
  variable: '--font-lora',
  subsets: ['latin'],
  weight: ['400', '500'],
  style: ['normal', 'italic'],
})

export const metadata: Metadata = {
  title: 'Neural Heirloom',
  description: 'A private archive of memory and voice',
  icons: {
    icon: '/brand_assets/favicon.svg',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" style={{ colorScheme: 'light' }}>
      <head>
        <meta name="color-scheme" content="light" />
      </head>
      <body
        className={`${cormorant.variable} ${lora.variable} antialiased`}
        style={{ backgroundColor: '#F5F0E8', color: '#2C2416' }}
      >
        {children}
      </body>
    </html>
  )
}
