"use client"

import { useMemo, useState } from "react"
import { Activity, Database, Download, Loader2, TrendingUp, Users, Warehouse } from "lucide-react"
import { AppShell, PageHeader } from "@/components/layout/AppShell"
import { Card, CardBody, CardHeader } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Table } from "@/components/ui/Table"
import { StatCard } from "@/components/ui/StatCard"
import {
  MovementsAreaChart,
  MovementsByReasonChart,
  ValuationByLocationChart,
} from "@/components/reports/ReportChart"
import { useAuditFeed, useMovements, useStockValuation } from "@/lib/queries"
import { fromCents, relativeTime } from "@/lib/format"
import { downloadCSV } from "@/lib/csv"
import type { AuditEvent, Movement, StockValuationRow } from "@/lib/api"

type Tab = "valuation" | "movements" | "audit"

const TABS: { value: Tab; label: string; icon: typeof Activity }[] = [
  { value: "valuation", label: "Stock valuation", icon: Database },
  { value: "movements", label: "Movements",       icon: TrendingUp },
  { value: "audit",     label: "Audit log",       icon: Activity },
]

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("valuation")
  return (
    <AppShell>
      <PageHeader
        title="Reports"
        subtitle="Operational truth from the inventory schema — charts, filters, export."
      />

      <div className="mb-4 inline-flex gap-1 rounded-2xl border border-border bg-card p-1">
        {TABS.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                tab === t.value
                  ? "bg-brand-gold/20 text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === "valuation" && <ValuationTab />}
      {tab === "movements" && <MovementsTab />}
      {tab === "audit"     && <AuditTab />}
    </AppShell>
  )
}

// ─── Valuation tab ─────────────────────────────────────────────────────────

function ValuationTab() {
  const { data, isLoading } = useStockValuation()
  const rows = data ?? []

  // Roll-up summary stats + per-location pie data.
  const summary = useMemo(() => {
    const totalValue = rows.reduce((acc, r) => acc + r.value_cents, 0)
    const totalUnits = rows.reduce((acc, r) => acc + r.on_hand, 0)
    const skuCount   = new Set(rows.map((r) => r.variant_id)).size
    const byLoc = new Map<string, number>()
    for (const r of rows) {
      byLoc.set(r.location_code, (byLoc.get(r.location_code) ?? 0) + r.value_cents)
    }
    const pie = Array.from(byLoc, ([name, value]) => ({ name, value }))
    return { totalValue, totalUnits, skuCount, pie }
  }, [rows])

  if (isLoading) return <Spinner />

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total value"      value={fromCents(summary.totalValue)} icon={Database}  tone="default" />
        <StatCard label="Units on hand"    value={summary.totalUnits.toLocaleString()} icon={Warehouse} tone="info" />
        <StatCard label="SKUs"             value={summary.skuCount} icon={Users}    tone="info" />
        <StatCard label="Locations"        value={summary.pie.length} icon={Warehouse} />
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-foreground">Value by location</h2>
        </CardHeader>
        <CardBody>
          {summary.pie.length === 0 ? (
            <p className="text-sm text-muted-foreground">No stock to value yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6 items-center">
              <ValuationByLocationChart data={summary.pie} />
              <ul className="space-y-1.5 text-sm">
                {summary.pie
                  .sort((a, b) => b.value - a.value)
                  .map((p) => (
                    <li key={p.name} className="flex justify-between gap-3">
                      <span className="text-muted-foreground">{p.name}</span>
                      <span className="font-semibold tabular-nums">{fromCents(p.value)}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </CardBody>
      </Card>

      <Table<StockValuationRow>
        rows={rows}
        rowKey={(r) => `${r.variant_id}:${r.location_id}`}
        defaultPageSize={50}
        searchPlaceholder="Search product, SKU, or location"
        searchMatch={(r, q) =>
          r.product_title.toLowerCase().includes(q) ||
          r.variant_sku.toLowerCase().includes(q) ||
          r.location_code.toLowerCase().includes(q)
        }
        rowActions={[
          { label: "Copy SKU", onSelect: (r) => { void navigator.clipboard?.writeText(r.variant_sku) } },
          { label: "View movements", onSelect: (r) => { window.location.href = `/reports?tab=movements&q=${encodeURIComponent(r.variant_sku)}` } },
        ]}
        footer={
          <div className="flex items-center justify-between">
            <span>{rows.length} row{rows.length === 1 ? "" : "s"}</span>
            <button
              type="button"
              onClick={() =>
                downloadCSV("stock-valuation.csv", rows, [
                  { key: "product_title", label: "Product" },
                  { key: "variant_sku",   label: "SKU" },
                  { key: "location_code", label: "Location" },
                  { key: "on_hand",       label: "On hand" },
                  { key: "cost_cents",    label: "Unit cost (cents)" },
                  { key: "value_cents",   label: "Value (cents)" },
                ])
              }
              className="inline-flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground"
            >
              <Download className="h-3 w-3" /> Export CSV
            </button>
          </div>
        }
        columns={[
          { key: "title",   header: "Product",  cellClass: "font-semibold text-foreground", cell: (r) => r.product_title },
          { key: "sku",     header: "SKU",      cellClass: "font-mono text-xs text-muted-foreground", cell: (r) => r.variant_sku },
          { key: "loc",     header: "Location", cellClass: "text-muted-foreground", cell: (r) => r.location_code },
          { key: "on_hand", header: "On hand",  align: "right", cellClass: "tabular-nums", cell: (r) => r.on_hand },
          { key: "cost",    header: "Unit cost",align: "right", cellClass: "tabular-nums text-muted-foreground", cell: (r) => fromCents(r.cost_cents) },
          { key: "value",   header: "Value",    align: "right", cellClass: "tabular-nums font-semibold", cell: (r) => fromCents(r.value_cents) },
        ]}
      />
    </div>
  )
}

// ─── Movements tab ─────────────────────────────────────────────────────────

function MovementsTab() {
  const today = new Date()
  const lastWeek = new Date(today.getTime() - 7 * 86_400_000)
  const [from, setFrom] = useState(lastWeek.toISOString().slice(0, 10))
  const [to, setTo] = useState(today.toISOString().slice(0, 10))
  const { data, isLoading } = useMovements({ from, to, limit: 1000 })
  const rows = data ?? []

  // Time-series buckets (day × in/out) and reason histogram.
  const charts = useMemo(() => {
    const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    const days = new Map<string, { in: number; out: number }>()
    // Pre-populate so the chart shows zeros for empty days.
    const fromMs = new Date(from).getTime()
    const toMs   = new Date(to).getTime()
    for (let ms = fromMs; ms <= toMs; ms += 86_400_000) {
      days.set(dayKey(new Date(ms).toISOString()), { in: 0, out: 0 })
    }
    const reasons = new Map<string, number>()
    for (const m of rows) {
      const k = dayKey(m.created_at)
      const slot = days.get(k) ?? { in: 0, out: 0 }
      if (m.delta > 0) slot.in += m.delta
      else slot.out += Math.abs(m.delta)
      days.set(k, slot)
      reasons.set(m.reason, (reasons.get(m.reason) ?? 0) + 1)
    }
    return {
      time:   Array.from(days, ([day, v]) => ({ day, ...v })),
      reason: Array.from(reasons, ([reason, count]) => ({ reason: reason.replace("_", " "), count })),
    }
  }, [rows, from, to])

  if (isLoading) return <Spinner />

  return (
    <div className="space-y-6">
      <Card>
        <CardBody className="flex flex-wrap items-end gap-3">
          <DateField label="From" value={from} onChange={setFrom} />
          <DateField label="To"   value={to}   onChange={setTo} />
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <Badge tone="neutral">{rows.length} movements</Badge>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6">
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-foreground">Volume by day</h2>
          </CardHeader>
          <CardBody>
            <MovementsAreaChart data={charts.time} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-foreground">By reason</h2>
          </CardHeader>
          <CardBody>
            {charts.reason.length === 0 ? (
              <p className="text-sm text-muted-foreground">No movements in this window.</p>
            ) : (
              <MovementsByReasonChart data={charts.reason} />
            )}
          </CardBody>
        </Card>
      </div>

      <Table<Movement>
        rows={rows}
        rowKey={(m) => m.id}
        defaultPageSize={50}
        searchPlaceholder="Search product, SKU, reason, or reference"
        searchMatch={(m, q) =>
          (m.product_title ?? "").toLowerCase().includes(q) ||
          (m.variant_sku ?? "").toLowerCase().includes(q) ||
          m.reason.toLowerCase().includes(q) ||
          (m.reference ?? "").toLowerCase().includes(q)
        }
        rowActions={[
          { label: "Copy reference", onSelect: (m) => { void navigator.clipboard?.writeText(m.reference ?? "") }, hidden: (m) => !m.reference },
        ]}
        footer={
          <div className="flex items-center justify-between">
            <span>{rows.length} movement{rows.length === 1 ? "" : "s"}</span>
            <button
              type="button"
              onClick={() =>
                downloadCSV("movements.csv", rows, [
                  { key: "created_at",    label: "When" },
                  { key: "product_title", label: "Product" },
                  { key: "variant_sku",   label: "SKU" },
                  { key: "location_code", label: "Location" },
                  { key: "delta",         label: "Delta" },
                  { key: "reason",        label: "Reason" },
                  { key: "reference",     label: "Reference" },
                  { key: "actor",         label: "Actor" },
                ])
              }
              className="inline-flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground"
            >
              <Download className="h-3 w-3" /> Export CSV
            </button>
          </div>
        }
        columns={[
          { key: "when",  header: "When",     cellClass: "text-xs text-muted-foreground whitespace-nowrap", cell: (m) => relativeTime(m.created_at) },
          { key: "title", header: "Product",  cellClass: "font-semibold text-foreground", cell: (m) => m.product_title ?? "—" },
          { key: "sku",   header: "SKU",      cellClass: "font-mono text-xs text-muted-foreground", cell: (m) => m.variant_sku ?? "—" },
          { key: "loc",   header: "Location", cellClass: "text-muted-foreground", cell: (m) => m.location_code ?? "—" },
          {
            key: "delta", header: "Delta", align: "right",
            cell: (m) =>
              m.delta > 0 ? <Badge tone="success">+{m.delta}</Badge> : <Badge tone="danger">{m.delta}</Badge>,
          },
          { key: "reason", header: "Reason", cell: (m) => <Badge tone="neutral">{m.reason.replace("_", " ")}</Badge> },
          { key: "ref",    header: "Reference", cellClass: "font-mono text-[11px] text-muted-foreground", cell: (m) => m.reference ?? "—" },
        ]}
      />
    </div>
  )
}

// ─── Audit tab ─────────────────────────────────────────────────────────────

function AuditTab() {
  const today = new Date()
  const lastWeek = new Date(today.getTime() - 7 * 86_400_000)
  const [from] = useState(lastWeek.toISOString())
  const { data, isLoading } = useAuditFeed({ from, limit: 500 })
  const rows = data ?? []

  if (isLoading) return <Spinner />

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Events (7d)"    value={rows.length}             icon={Activity} />
        <StatCard label="Unique actors"  value={new Set(rows.map((r) => r.actor ?? "")).size} icon={Users} />
        <StatCard label="Entity types"   value={new Set(rows.map((r) => r.entity_type)).size} icon={Database} />
        <StatCard label="Distinct actions" value={new Set(rows.map((r) => r.action)).size} icon={TrendingUp} />
      </div>

      <Table<AuditEvent>
        rows={rows}
        rowKey={(r) => String(r.id)}
        defaultPageSize={50}
        searchPlaceholder="Search summary, actor, or entity"
        searchMatch={(r, q) =>
          r.summary.toLowerCase().includes(q) ||
          (r.actor ?? "").toLowerCase().includes(q) ||
          (r.actor_name ?? "").toLowerCase().includes(q) ||
          r.entity_type.toLowerCase().includes(q) ||
          r.action.toLowerCase().includes(q)
        }
        footer={
          <div className="flex items-center justify-between">
            <span>{rows.length} event{rows.length === 1 ? "" : "s"}</span>
            <button
              type="button"
              onClick={() =>
                downloadCSV("audit.csv", rows, [
                  { key: "created_at",  label: "When" },
                  { key: "actor_name",  label: "Actor name" },
                  { key: "actor",       label: "Actor" },
                  { key: "action",      label: "Action" },
                  { key: "entity_type", label: "Entity type" },
                  { key: "entity_id",   label: "Entity id" },
                  { key: "summary",     label: "Summary" },
                ])
              }
              className="inline-flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground"
            >
              <Download className="h-3 w-3" /> Export CSV
            </button>
          </div>
        }
        columns={[
          { key: "when",   header: "When", cellClass: "text-xs text-muted-foreground whitespace-nowrap", cell: (r) => relativeTime(r.created_at) },
          { key: "actor",  header: "Actor", cell: (r) => r.actor_name ?? r.actor ?? "—" },
          { key: "action", header: "Action", cellClass: "font-mono text-xs", cell: (r) => r.action },
          { key: "entity", header: "Entity", cellClass: "font-mono text-xs text-muted-foreground", cell: (r) => r.entity_type },
          { key: "summary", header: "Summary", cell: (r) => r.summary },
        ]}
      />
    </div>
  )
}

// ─── Bits ──────────────────────────────────────────────────────────────────

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:border-brand-gold focus:outline-none focus:ring-2 focus:ring-brand-gold/30 transition"
      />
    </div>
  )
}

function Spinner() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading…
    </div>
  )
}
