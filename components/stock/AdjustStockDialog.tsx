"use client"

import { useState } from "react"
import { Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { FieldLabel, Input, Select } from "@/components/ui/Input"
import { useAdjustStock } from "@/lib/queries"
import type { StockLevel, StockMovementReason } from "@/lib/api"

export const STOCK_REASONS: { value: StockMovementReason; label: string }[] = [
  { value: "receive",           label: "Receive (PO)" },
  { value: "return",            label: "Customer return" },
  { value: "adjustment",        label: "Manual adjustment" },
  { value: "count_correction",  label: "Cycle count correction" },
]

/**
 * Adjust the on-hand quantity for one variant @ location. Applying an
 * adjustment appends an inv.stock.changed event, which flows to the catalog
 * and updates "X left in stock" on the storefront.
 */
export function AdjustStockDialog({ row, onClose }: { row: StockLevel; onClose: () => void }) {
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
              {STOCK_REASONS.map((r) => (
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
