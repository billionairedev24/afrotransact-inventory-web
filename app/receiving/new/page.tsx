"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, Plus, Trash2 } from "lucide-react"
import { AppShell, PageHeader } from "@/components/layout/AppShell"
import { Card, CardBody, CardHeader } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { FieldLabel, Input, Select, Textarea } from "@/components/ui/Input"
import { ScannerInput } from "@/components/ui/Scanner"
import { useCreatePO, useProducts, useStock } from "@/lib/queries"
import { fromCents } from "@/lib/format"

interface DraftLine {
  variantId: string
  quantity: number
  unitCost: number   // dollars (UI-side; converted to cents on submit)
}

export default function NewPOPage() {
  const router = useRouter()
  const products = useProducts()
  const stock = useStock()
  const create = useCreatePO()

  const [supplierName, setSupplierName] = useState("")
  const [supplierRef, setSupplierRef] = useState("")
  const [expectedAt, setExpectedAt] = useState("")
  const [notes, setNotes] = useState("")
  const [locationId, setLocationId] = useState("")
  const [lines, setLines] = useState<DraftLine[]>([])

  // Available variants come from the products query (flatten product.variants).
  const variants = useMemo(() => {
    if (!products.data) return []
    return products.data.flatMap((p) =>
      (p.variants ?? []).map((v) => ({
        id: v.id,
        sku: v.sku,
        title: p.title,
        listPriceCents: v.list_price_cents,
      })),
    )
  }, [products.data])

  // Auto-fill the location from the first stock row we see.
  const defaultLocation = stock.data?.[0]?.location_id ?? ""
  if (!locationId && defaultLocation) {
    setLocationId(defaultLocation)
  }

  const total = lines.reduce((acc, l) => acc + l.quantity * Math.round(l.unitCost * 100), 0)

  function addLine() {
    setLines((ls) => [...ls, { variantId: "", quantity: 1, unitCost: 0 }])
  }
  function updateLine(i: number, patch: Partial<DraftLine>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }
  function removeLine(i: number) {
    setLines((ls) => ls.filter((_, idx) => idx !== i))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const cleaned = lines
      .filter((l) => l.variantId && l.quantity > 0)
      .map((l) => ({
        variant_id: l.variantId,
        quantity: l.quantity,
        unit_cost_cents: Math.round(l.unitCost * 100),
      }))
    if (cleaned.length === 0) return
    const po = await create.mutateAsync({
      supplier_name: supplierName.trim(),
      supplier_ref: supplierRef.trim() || undefined,
      location_id: locationId,
      expected_at: expectedAt ? new Date(expectedAt).toISOString() : null,
      notes: notes.trim() || undefined,
      lines: cleaned,
    })
    router.push(`/receiving/${po.id}`)
  }

  return (
    <AppShell>
      <Link
        href="/receiving"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3"
      >
        <ChevronLeft className="h-4 w-4" /> Receiving
      </Link>
      <PageHeader title="New purchase order" subtitle="Draft a PO. Approve it to lock the terms with the supplier." />

      <form onSubmit={submit} className="space-y-6">
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-foreground">Supplier & destination</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel htmlFor="sup">Supplier name</FieldLabel>
                <Input id="sup" required value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Naija Foods LLC" />
              </div>
              <div>
                <FieldLabel htmlFor="ref">Supplier reference</FieldLabel>
                <Input id="ref" value={supplierRef} onChange={(e) => setSupplierRef(e.target.value)} placeholder="(their PO #)" />
              </div>
              <div>
                <FieldLabel htmlFor="exp">Expected arrival</FieldLabel>
                <Input id="exp" type="date" value={expectedAt} onChange={(e) => setExpectedAt(e.target.value)} />
              </div>
              <div>
                <FieldLabel htmlFor="loc">Destination location</FieldLabel>
                <Input
                  id="loc"
                  required
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  placeholder="Location UUID"
                  className="font-mono text-xs"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Auto-filled from the first active location.
                </p>
              </div>
            </div>
            <div>
              <FieldLabel htmlFor="notes">Notes</FieldLabel>
              <Textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="(optional)" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Line items</h2>
            <Button size="sm" variant="secondary" type="button" onClick={addLine}>
              <Plus className="h-3.5 w-3.5" /> Add line
            </Button>
          </CardHeader>
          <div className="px-5 pt-4">
            <FieldLabel>Scan to add a line</FieldLabel>
            <ScannerInput
              autoFocus={false}
              placeholder="Scan SKU / UPC — adds a line with qty 1"
              onResolved={(v) => {
                setLines((prev) => [
                  ...prev,
                  { variantId: v.variant_id, quantity: 1, unitCost: 0 },
                ])
              }}
            />
          </div>
          {lines.length === 0 ? (
            <CardBody>
              <p className="text-sm text-muted-foreground">
                Add at least one variant you&apos;re ordering from this supplier.
              </p>
            </CardBody>
          ) : (
            <div className="px-5 py-4 space-y-3">
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,3fr)_minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-3">
                  <div>
                    <FieldLabel htmlFor={`v${i}`}>Variant</FieldLabel>
                    <Select
                      id={`v${i}`}
                      value={line.variantId}
                      onChange={(e) => updateLine(i, { variantId: e.target.value })}
                      required
                    >
                      <option value="">Select a variant…</option>
                      {variants.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.title} — {v.sku}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <FieldLabel htmlFor={`q${i}`}>Qty</FieldLabel>
                    <Input
                      id={`q${i}`}
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) => updateLine(i, { quantity: parseInt(e.target.value || "0", 10) })}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor={`c${i}`}>Unit cost (USD)</FieldLabel>
                    <Input
                      id={`c${i}`}
                      type="number"
                      step="0.01"
                      min={0}
                      value={line.unitCost}
                      onChange={(e) => updateLine(i, { unitCost: parseFloat(e.target.value || "0") })}
                    />
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeLine(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <div className="flex justify-end pt-3 border-t border-border">
                <p className="text-sm">
                  <span className="text-muted-foreground">Total:</span>{" "}
                  <span className="font-semibold tabular-nums">{fromCents(total)}</span>
                </p>
              </div>
            </div>
          )}
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" loading={create.isPending} disabled={lines.length === 0}>
            Create draft
          </Button>
          <Link href="/receiving">
            <Button type="button" variant="ghost">Cancel</Button>
          </Link>
        </div>
      </form>
    </AppShell>
  )
}
