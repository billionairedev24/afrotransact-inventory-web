"use client"

import Link from "next/link"
import { useState } from "react"
import { ArrowLeftRight, Loader2, Minus, Plus, Warehouse } from "lucide-react"
import { AppShell, PageHeader } from "@/components/layout/AppShell"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { EmptyState } from "@/components/ui/EmptyState"
import { FieldLabel, Input, Select } from "@/components/ui/Input"
import { Table } from "@/components/ui/Table"
import { useAdjustStock, useStock } from "@/lib/queries"
import type { StockLevel, StockMovementReason } from "@/lib/api"

const REASONS: { value: StockMovementReason; label: string }[] = [
  { value: "receive",           label: "Receive (PO)" },
  { value: "return",            label: "Customer return" },
  { value: "adjustment",        label: "Manual adjustment" },
  { value: "count_correction",  label: "Cycle count correction" },
]

export default function StockPage() {
  const { data, isLoading, isError } = useStock()
  const [active, setActive] = useState<StockLevel | null>(null)

  return (
    <AppShell>
      <PageHeader
        title="Stock"
        subtitle="On-hand and available per SKU + location."
        actions={
          <Link href="/stock/transfer">
            <Button variant="secondary">
              <ArrowLeftRight className="h-4 w-4 mr-1.5" /> Transfer
            </Button>
          </Link>
        }
      />

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : isError ? (
        <Card className="border-red-200 bg-red-50/50">
          <p className="px-5 py-4 text-sm text-red-800">Could not load stock.</p>
        </Card>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={Warehouse}
          title="No stock to show yet"
          body="Once a product has variants and at least one active location, you'll see rows here."
        />
      ) : (
        <Table<StockLevel>
          rows={data}
          rowKey={(s) => `${s.variant_id}:${s.location_id}`}
          defaultPageSize={50}
          searchPlaceholder="Search product, SKU, or location"
          searchMatch={(s, q) =>
            s.product_title.toLowerCase().includes(q) ||
            s.variant_sku.toLowerCase().includes(q) ||
            s.location_code.toLowerCase().includes(q)
          }
          selectable
          bulkActions={(selected, clear) => (
            <>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  // Stub: a real bulk-print flow would call /reports/stock-labels?ids=…
                  // and stream a PDF to the operator. Wiring that endpoint is
                  // out of scope for this pass.
                  alert(`Would print ${selected.length} labels`)
                  clear()
                }}
              >
                Print labels
              </Button>
            </>
          )}
          rowActions={[
            { label: "Adjust stock",     onSelect: (s) => setActive(s) },
            { label: "Transfer to…",     onSelect: () => { window.location.href = "/stock/transfer" } },
            { label: "View movements",   onSelect: (s) => { window.location.href = `/reports?tab=movements&variant_id=${s.variant_id}` } },
            { label: "Open product",     onSelect: (s) => { window.location.href = `/products/${s.variant_id}` } },
            { label: "Copy SKU",         onSelect: (s) => { void navigator.clipboard?.writeText(s.variant_sku) } },
          ]}
          columns={[
            { key: "title",   header: "Product",  cellClass: "font-semibold text-foreground", cell: (s) => s.product_title },
            { key: "sku",     header: "SKU",      cellClass: "font-mono text-xs text-muted-foreground", cell: (s) => s.variant_sku },
            { key: "loc",     header: "Location", cellClass: "text-muted-foreground", cell: (s) => s.location_code },
            { key: "on_hand", header: "On hand",  align: "right", cellClass: "tabular-nums", cell: (s) => s.on_hand },
            { key: "held",    header: "Held",     align: "right", cellClass: "tabular-nums text-muted-foreground", cell: (s) => s.held },
            {
              key: "avail", header: "Available", align: "right", cellClass: "tabular-nums",
              cell: (s) =>
                s.available <= 0 ? <Badge tone="danger">{s.available}</Badge>
                : s.available <= 5 ? <Badge tone="warning">{s.available}</Badge>
                : <span className="font-semibold">{s.available}</span>,
            },
          ]}
        />
      )}

      {active && <AdjustDialog row={active} onClose={() => setActive(null)} />}
    </AppShell>
  )
}

function AdjustDialog({ row, onClose }: { row: StockLevel; onClose: () => void }) {
  const adjust = useAdjustStock()
  const [delta, setDelta] = useState(0)
  const [reason, setReason] = useState<StockMovementReason>("receive")
  const [reference, setReference] = useState("")

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (delta === 0) return
    await adjust.mutateAsync({
      variant_id: row.variant_id,
      location_id: row.location_id,
      delta,
      reason,
      reference: reference.trim() || undefined,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-xl p-6">
        <header className="mb-4">
          <h2 className="text-base font-semibold text-foreground">Adjust stock</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {row.product_title} <span className="font-mono">({row.variant_sku})</span> @ {row.location_code}
          </p>
        </header>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <FieldLabel htmlFor="delta">Delta</FieldLabel>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => setDelta((d) => d - 1)}>
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <Input
                id="delta"
                type="number"
                value={delta}
                onChange={(e) => setDelta(parseInt(e.target.value || "0", 10))}
                className="text-center"
              />
              <Button type="button" size="sm" variant="secondary" onClick={() => setDelta((d) => d + 1)}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Positive to add stock, negative to remove. New on-hand: {Math.max(0, row.on_hand + delta)}
            </p>
          </div>
          <div>
            <FieldLabel htmlFor="reason">Reason</FieldLabel>
            <Select id="reason" value={reason} onChange={(e) => setReason(e.target.value as StockMovementReason)}>
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </Select>
          </div>
          <div>
            <FieldLabel htmlFor="ref">Reference</FieldLabel>
            <Input
              id="ref"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="PO number, ticket ID, etc."
            />
          </div>
          <div className="flex items-center justify-end gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={adjust.isPending} disabled={delta === 0}>
              Apply
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
