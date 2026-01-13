import type { Metadata } from 'next'
import { JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { Toaster } from "@/components/ui/toaster"
import { TabProvider } from "@/components/providers/TabProvider"

const jetbrainsMono = JetBrains_Mono({ 
  subsets: ['latin'],
  variable: '--font-jetbrains-mono'
})

export const metadata: Metadata = {
  title: 'Fintra',
  description: 'Plataforma de análisis financiero y bursátil',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className={`${jetbrainsMono.className} ${jetbrainsMono.variable}`}>
        <TabProvider>
          {children}
          <Toaster />
        </TabProvider>
      </body>
    </html>
  )
}
