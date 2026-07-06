import "./globals.css"
import type { ReactNode } from "react"
import { Providers } from "@/components/providers/Providers"

export const metadata = {
  title: "AfroTransact Inventory",
  description: "Internal inventory + listing management",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
