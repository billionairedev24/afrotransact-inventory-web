"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronLeft, ArrowRight } from "lucide-react"
import { AppShell, PageHeader } from "@/components/layout/AppShell"
import { Card, CardBody } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { FieldLabel, Input, Select } from "@/components/ui/Input"
import { ScannerInput } from "@/components/ui/Scanner"
import { useStock, useTransferStock } from "@/lib/queries"
import type { VariantLookup } from "@/lib/api"

export default function StockTransferPage() {
  const router = useRouter()
  const { data: stock } = useStock()
  const transfer = useTransferStock()

  const [variantId, setVariantId] = useState("")
  const [variantLabel, setVariantLabel] = useState("")
  const [fromLoc, setFromLoc] = useState("")
  const [toLoc, setToLoc] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")

  // Distinct locations come from the stock-level rows. /stock is the
  // canonical place a location surfaces today — no separate endpoint.
  const locations = useMemo(() => {
    const m = new Map<string, string>()
    for (const row of stock ?? []) m.set(row.location_id, row.location_code)
    return Array.from(m, ([id, code]) => ({ id, code }))
  }, [stock])

  // Show on-hand at the source location for the selected variant so the
  // operator knows the ceiling before they hit submit.
  const sourceOnHand = useMemo(() => {
    if (!variantId || !fromLoc) return null
    const row = (stock ?? []).find(
      (s) => s.variant_id === variantId && s.location_id === fromLoc,
    )
    return row?.on_hand ?? 0
  }, [stock, variantId, fromLoc])

  function onScan(v: VariantLookup) {
    setVariantId(v.variant_id)
    setVariantLabel(`${v.product_title} — ${v.sku}`)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const qty = parseInt(quantity, 10)
    if (!variantId || !fromLoc || !toLoc || !qty) return
    await transfer.mutateAsync({
      variant_id: variantId,
      from_location_id: fromLoc,
      to_location_id: toLoc,
      quantity: qty,
      reference: reference.trim() || undefined,
      notes: notes.trim() || undefined,
    })
    router.push("/stock")
  }

  return (
    <AppShell>
      <Link
        href="/stock"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3"
      >
        <ChevronLeft className="h-4 w-4" /> Stock
      </Link>
      <PageHeader
        title="Transfer stock"
        subtitle="Move units between locations. Emits two stock_movements + two stock-changed events in one transaction."
      />

      <Card>
        <CardBody>
          <form onSubmit={submit} className="space-y-5 max-w-2xl">
            <div>
              <FieldLabel>Scan variant</FieldLabel>
              <ScannerInput onResolved={onScan} placeholder="Scan SKU / UPC to select a variant…" />
              {variantLabel && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  Selected: <span className="text-foreground font-medium">{variantLabel}</span>
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-end">
              <div>
                <FieldLabel>From</FieldLabel>
                <Select value={fromLoc} onChange={(e) => setFromLoc(e.target.value)} required>
                  <option value="">Source location…</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.code}
                    </option>
                  ))}
                </Select>
                {sourceOnHand != null && (
                  <p className="text-xs text-muted-foreground mt-1">
                    On hand here: <span className="tabular-nums text-foreground">{sourceOnHand}</span>
                  </p>
                )}
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground self-end mb-3 hidden sm:block" />
              <div>
                <FieldLabel>To</FieldLabel>
                <Select value={toLoc} onChange={(e) => setToLoc(e.target.value)} required>
                  <option value="">Destination location…</option>
                  {locations
                    .filter((l) => l.id !== fromLoc)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.code}
                      </option>
                    ))}
                </Select>
              </div>
            </div>

            <div>
              <FieldLabel>Quantity</FieldLabel>
              <Input
                type="number"
                min={1}
                step={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-32"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <FieldLabel>Reference (optional)</FieldLabel>
                <Input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. TRF-2026-04-19-A"
                />
              </div>
              <div>
                <FieldLabel>Notes (optional)</FieldLabel>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason / context" />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                type="submit"
                loading={transfer.isPending}
                disabled={!variantId || !fromLoc || !toLoc || parseInt(quantity, 10) < 1}
              >
                Transfer
              </Button>
              <Link href="/stock" className="text-sm text-muted-foreground hover:text-foreground">
                Cancel
              </Link>
            </div>
          </form>
        </CardBody>
      </Card>
    </AppShell>
  )
}
