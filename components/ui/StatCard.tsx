"use client"

import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/cn"

/**
 * Operator stat tile. Two flavours:
 *   - Plain stat (no href) — just numbers.
 *   - Drill-down (href) — wraps in a Link so the whole card is clickable.
 *
 * The `tone` prop colours the icon chip + value to surface urgency
 * (e.g. low stock = danger). Defaults to brand-gold.
 */

export type StatTone = "default" | "info" | "warning" | "danger" | "success"

const TONE_BG: Record<StatTone, string> = {
  default: "bg-brand-gold/15 text-brand-gold-foreground",
  info:    "bg-blue-50 text-blue-700",
  warning: "bg-amber-50 text-amber-800",
  danger:  "bg-red-50 text-red-700",
  success: "bg-emerald-50 text-emerald-700",
}

const TONE_VALUE: Record<StatTone, string> = {
  default: "text-foreground",
  info:    "text-blue-700",
  warning: "text-amber-700",
  danger:  "text-red-700",
  success: "text-emerald-700",
}

interface Props {
  label: string
  value: string | number
  hint?: string
  icon?: LucideIcon
  tone?: StatTone
  href?: string
  loading?: boolean
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  href,
  loading,
}: Props) {
  const inner = (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-5 transition-colors hover:bg-muted/30">
      <div className="flex items-start justify-between gap-3">
        {Icon && (
          <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", TONE_BG[tone])}>
            <Icon className="h-4 w-4" />
          </div>
        )}
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground text-right">
          {label}
        </p>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <p className={cn("text-3xl font-bold tabular-nums leading-none", TONE_VALUE[tone])}>
          {value}
          {loading && (
            <span
              aria-hidden
              className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/40 align-middle animate-pulse"
            />
          )}
        </p>
      </div>
      {hint && (
        <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{hint}</p>
      )}
    </div>
  )
  if (!href) return inner
  return <Link href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold rounded-2xl">{inner}</Link>
}
