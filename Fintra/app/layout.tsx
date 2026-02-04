import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from "@/components/ui/toaster"
import { TabProvider } from "@/components/providers/TabProvider"
import { Inter } from 'next/font/google'
import { cn } from '@/lib/utils'

const workSans = Inter({
  subsets: ['latin'],
  variable: '--font-work-sans',
  display: 'swap',
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
    <html lang="es" className={workSans.variable}>
      <body className={cn(workSans.className)}>
        <TabProvider>
          {children}
          <Toaster />
        </TabProvider>
      </body>
    </html>
  )
}
