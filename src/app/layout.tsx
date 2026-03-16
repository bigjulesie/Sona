import type { Metadata } from 'next'
import { Cormorant_Garamond, Lora } from 'next/font/google'
import { GeistSans } from 'geist/font/sans'
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
  title: { default: 'Sona', template: '%s | Sona' },
  description: 'Meet the people who shaped your world',
  icons: [
    { rel: 'icon', url: '/favicon.svg', type: 'image/svg+xml' },
    { rel: 'icon', url: '/favicon.ico', sizes: 'any' },
  ],
  openGraph: {
    title: 'Sona',
    description: 'Meet the people who shaped your world',
    siteName: 'Sona',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sona',
    description: 'Meet the people who shaped your world',
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
        className={`${cormorant.variable} ${lora.variable} ${GeistSans.variable} antialiased`}
        style={{ backgroundColor: '#ffffff', color: '#1a1a1a' }}
      >
        {children}
      </body>
    </html>
  )
}
