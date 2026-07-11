"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { signOutFromKeycloak } from "@/lib/signout"
import {
  BarChart3,
  Box,
  ClipboardCheck,
  LayoutDashboard,
  ImageIcon,
  LogOut,
  RotateCcw,
  Send,
  Truck,
  Warehouse,
  type LucideIcon,
} from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/cn"
import { useGlobalScannerHotkey } from "@/hooks/useScannerFocus"
import { useIsFetching, useIsMutating } from "@tanstack/react-query"
import { NotificationsBell } from "@/components/notifications/NotificationsBell"

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

const NAV: NavItem[] = [
  { href: "/",             label: "Dashboard",     icon: LayoutDashboard },
  // First-party model: admins manage AfroTransact's products in one place
  // (Products). The marketplace catalog is derived automatically from
  // inventory events, so no separate "Catalog" authoring surface here.
  { href: "/products",     label: "Products",      icon: Box },
  { href: "/media",        label: "Media",         icon: ImageIcon },
  { href: "/stock",        label: "Stock",         icon: Warehouse },
  { href: "/receiving",    label: "Receiving",     icon: Truck },
  { href: "/pick-tasks",   label: "Pick queue",    icon: Send },
  { href: "/returns",      label: "Returns",       icon: RotateCcw },
  { href: "/cycle-counts", label: "Cycle counts",  icon: ClipboardCheck },
  { href: "/reports",      label: "Reports",       icon: BarChart3 },
]

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? ""
  const { data: session } = useSession()
  const user = session?.user
  const idToken = (session as { idToken?: string } | null)?.idToken
  // Wire the global "/" hotkey: focuses whichever ScannerInput is mounted
  // on the current page. No-op on pages with no scanner.
  useGlobalScannerHotkey()

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] bg-muted/30">
      <aside className="hidden lg:flex flex-col border-r border-border bg-card">
        <Link href="/" className="flex h-16 items-center gap-2.5 border-b border-border px-6">
          {/* Brand Deck primary horizontal lockup (yellow bag + black wordmark). */}
          <img src="/brand-logo-2/Logos/Black_Yellow.svg" alt="AfroTransact" className="h-6 w-auto shrink-0" />
          <span className="rounded-md bg-brand-gold/20 px-1.5 py-0.5 text-[11px] font-semibold text-foreground">
            Inventory
          </span>
        </Link>

        <nav className="flex-1 p-3 space-y-0.5">
          {NAV.map((item) => {
            const Icon = item.icon
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(item.href + "/")
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-brand-gold/15 text-foreground font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className={cn("h-4 w-4", active && "text-foreground")} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-border p-3">
          {user ? (
            <div className="rounded-xl bg-muted/40 p-3">
              <p className="truncate text-xs font-semibold text-foreground">{user.name ?? user.email}</p>
              <p className="truncate text-[11px] text-muted-foreground">{user.email}</p>
              <button
                type="button"
                onClick={() => void signOutFromKeycloak(idToken)}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Dev mode (no auth)</p>
          )}
        </div>
      </aside>

      <InflightBar />

      {/* Mobile top bar */}
      <header className="lg:hidden border-b border-border bg-card px-4 py-3 flex items-center gap-2">
        <img src="/brand-logo-2/Logos/Black_Yellow.svg" alt="AfroTransact" className="h-5 w-auto shrink-0" />
        <span className="rounded-md bg-brand-gold/20 px-1.5 py-0.5 text-[10px] font-semibold text-foreground">Inv</span>
        <nav className="ml-auto flex items-center gap-1 overflow-x-auto">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-lg px-2.5 py-1.5 text-xs font-semibold",
                  active ? "bg-brand-gold/15 text-foreground" : "text-muted-foreground",
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
        <NotificationsBell />
      </header>

      <main className="min-w-0">
        {/* Desktop top utility bar — lives INSIDE the main column so it
            doesn't interfere with the 2-column grid auto-flow. Sticky
            so the bell + future user menu stay reachable on long pages. */}
        <div className="hidden lg:flex sticky top-0 z-30 h-16 items-center justify-end gap-2 border-b border-border bg-card/95 px-6 backdrop-blur">
          <NotificationsBell />
        </div>
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  )
}

/**
 * A 2px progress bar pinned to the top of the viewport. Lights up whenever
 * TanStack has any fetch or mutation in flight — operators get a passive
 * "the system is working" signal without per-page spinners.
 */
function InflightBar() {
  const fetching = useIsFetching()
  const mutating = useIsMutating()
  const active = fetching + mutating > 0
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 bg-brand-gold transition-opacity",
        active ? "opacity-100 animate-pulse" : "opacity-0",
      )}
    />
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions}
    </header>
  )
}
