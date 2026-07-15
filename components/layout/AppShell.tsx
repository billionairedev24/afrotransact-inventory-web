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
  Menu,
  RotateCcw,
  Send,
  Truck,
  Warehouse,
  X,
  type LucideIcon,
} from "lucide-react"
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react"
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

  // Mobile navigation drawer. Below `lg` the sidebar collapses behind a
  // hamburger; the same nav content is reused so phones get icons + the
  // sign-out control (previously unreachable on mobile).
  const [menuOpen, setMenuOpen] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  // Close the drawer whenever the route changes (tapping a link navigates).
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  // While open: lock body scroll, close on Escape, move focus into the panel.
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false)
    }
    document.addEventListener("keydown", onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    closeRef.current?.focus()
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [menuOpen])

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] bg-muted/30">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col border-r border-border bg-card">
        <SidebarNav pathname={pathname} user={user} idToken={idToken} />
      </aside>

      <InflightBar />

      {/* Mobile top bar: hamburger + brand + notifications. */}
      <header className="lg:hidden sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          className="-ml-1.5 rounded-lg p-2 text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/" className="flex items-center gap-2">
          <img src="/brand/logo.svg" alt="AfroTransact" className="h-6 w-auto shrink-0" />
          <span className="rounded-md bg-brand-gold/20 px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
            Inventory
          </span>
        </Link>
        <div className="ml-auto">
          <NotificationsBell />
        </div>
      </header>

      {/* Mobile drawer backdrop */}
      <div
        aria-hidden
        onClick={() => setMenuOpen(false)}
        className={cn(
          "fixed inset-0 z-40 bg-brand-dark/50 lg:hidden transition-opacity duration-200 motion-reduce:transition-none",
          menuOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      {/* Mobile drawer panel — off-canvas, slides in from the left. */}
      <aside
        id="mobile-nav"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        inert={!menuOpen}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] flex-col border-r border-border bg-card shadow-xl lg:hidden",
          "transition-transform duration-200 ease-out motion-reduce:transition-none",
          menuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <SidebarNav
          pathname={pathname}
          user={user}
          idToken={idToken}
          onNavigate={() => setMenuOpen(false)}
          onClose={() => setMenuOpen(false)}
          closeRef={closeRef}
        />
      </aside>

      <main className="min-w-0 overflow-x-clip">
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
 * Shared sidebar contents: brand lockup, primary nav, and the user /
 * sign-out block. Rendered both in the fixed desktop sidebar and inside
 * the mobile drawer so the two stay in lockstep. `onNavigate` lets the
 * mobile drawer close itself when a link is tapped; `onClose`/`closeRef`
 * wire up the drawer's close button (desktop passes neither).
 */
function SidebarNav({
  pathname,
  user,
  idToken,
  onNavigate,
  onClose,
  closeRef,
}: {
  pathname: string
  user?: { name?: string | null; email?: string | null } | null
  idToken?: string
  onNavigate?: () => void
  onClose?: () => void
  closeRef?: RefObject<HTMLButtonElement | null>
}) {
  return (
    <>
      <div className="flex h-14 lg:h-16 items-center gap-2.5 border-b border-border px-4 lg:px-6">
        <Link href="/" onClick={onNavigate} className="flex min-w-0 items-center gap-2.5">
          {/* Brand primary horizontal lockup (yellow bag + black wordmark). */}
          <img src="/brand/logo.svg" alt="AfroTransact" className="h-6 w-auto shrink-0" />
          <span className="rounded-md bg-brand-gold/20 px-1.5 py-0.5 text-[11px] font-semibold text-foreground">
            Inventory
          </span>
        </Link>
        {onClose && (
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="ml-auto rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
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
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold",
                active
                  ? "bg-brand-gold/15 text-foreground font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", active && "text-foreground")} />
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
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold rounded"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Dev mode (no auth)</p>
        )}
      </div>
    </>
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
