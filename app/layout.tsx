import "./globals.css"
import type { ReactNode } from "react"
import { Providers } from "@/components/providers/Providers"

export const metadata = {
  title: "AfroTransact Inventory",
  description: "Internal inventory + listing management",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  // suppressHydrationWarning: browser extensions (e.g. Storylane) inject
  // attributes onto <html>/<body> before React hydrates, which otherwise
  // trips a hydration mismatch warning.
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
