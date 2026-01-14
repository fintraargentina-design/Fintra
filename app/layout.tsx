import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from "@/components/ui/toaster"
import { TabProvider } from "@/components/providers/TabProvider"

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
      <body>
        <TabProvider>
          {children}
          <Toaster />
        </TabProvider>
      </body>
    </html>
  )
}
