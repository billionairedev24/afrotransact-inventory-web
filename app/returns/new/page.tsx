"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, Plus, Trash2 } from "lucide-react"
import { AppShell, PageHeader } from "@/components/layout/AppShell"
import { Card, CardBody, CardHeader } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { FieldLabel, Input, Select, Textarea } from "@/components/ui/Input"
import { useCreateReturn, useProducts } from "@/lib/queries"
import type { ReturnCondition } from "@/lib/api"

interface DraftLine {
  variantId: string
  quantity: number
  condition: ReturnCondition
  notes: string
}

const CONDITIONS: { value: ReturnCondition; label: string }[] = [
  { value: "unknown",   label: "Unknown (inspect later)" },
  { value: "new",       label: "New (sealed/unused)" },
  { value: "opened",    label: "Opened" },
  { value: "damaged",   label: "Damaged" },
  { value: "defective", label: "Defective" },
]

export default function NewReturnPage() {
  const router = useRouter()
  const products = useProducts()
  const create = useCreateReturn()

  const [form, setForm] = useState({
    externalOrderId: "",
    externalOrderNumber: "",
    reason: "",
    buyerName: "",
    rmaUrl: "",
    notes: "",
  })
  const [lines, setLines] = useState<DraftLine[]>([
    { variantId: "", quantity: 1, condition: "unknown", notes: "" },
  ])

  const variants = useMemo(() => {
    if (!products.data) return []
    return products.data.flatMap((p) =>
      (p.variants ?? []).map((v) => ({
        id: v.id,
        sku: v.sku,
        title: p.title,
      })),
    )
  }, [products.data])

  function addLine() {
    setLines((ls) => [...ls, { variantId: "", quantity: 1, condition: "unknown", notes: "" }])
  }
  function updateLine(i: number, patch: Partial<DraftLine>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }
  function removeLine(i: number) {
    setLines((ls) => ls.filter((_, idx) => idx !== i))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const payloadLines = lines
      .filter((l) => l.variantId && l.quantity > 0)
      .map((l) => ({
        variant_id: l.variantId,
        quantity: l.quantity,
        condition: l.condition,
        notes: l.notes.trim() || undefined,
      }))
    if (payloadLines.length === 0) return
    const ret = await create.mutateAsync({
      external_order_id: form.externalOrderId.trim(),
      external_order_number: form.externalOrderNumber.trim() || undefined,
      reason: form.reason.trim() || undefined,
      buyer_name: form.buyerName.trim() || undefined,
      rma_url: form.rmaUrl.trim() || undefined,
      notes: form.notes.trim() || undefined,
      lines: payloadLines,
    })
    router.push(`/returns/${ret.id}`)
  }

  return (
    <AppShell>
      <Link
        href="/returns"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3"
      >
        <ChevronLeft className="h-4 w-4" /> Returns
      </Link>
      <PageHeader title="New return" subtitle="Open an RMA. Status starts as requested; mark received once units arrive, then process per line." />

      <form onSubmit={submit} className="space-y-6">
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold">Order reference</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel htmlFor="oid">Order ID</FieldLabel>
                <Input
                  id="oid"
                  required
                  value={form.externalOrderId}
                  onChange={(e) => setForm({ ...form, externalOrderId: e.target.value })}
                  placeholder="UUID from the order"
                  className="font-mono text-xs"
                />
              </div>
              <div>
                <FieldLabel htmlFor="onum">Order number</FieldLabel>
                <Input
                  id="onum"
                  value={form.externalOrderNumber}
                  onChange={(e) => setForm({ ...form, externalOrderNumber: e.target.value })}
                  placeholder="AT-12345 (display only)"
                />
              </div>
              <div>
                <FieldLabel htmlFor="bn">Buyer name</FieldLabel>
                <Input
                  id="bn"
                  value={form.buyerName}
                  onChange={(e) => setForm({ ...form, buyerName: e.target.value })}
                />
              </div>
              <div>
                <FieldLabel htmlFor="rmaurl">RMA / shipping label URL</FieldLabel>
                <Input
                  id="rmaurl"
                  value={form.rmaUrl}
                  onChange={(e) => setForm({ ...form, rmaUrl: e.target.value })}
                  placeholder="(optional)"
                />
              </div>
            </div>
            <div>
              <FieldLabel htmlFor="reason">Reason</FieldLabel>
              <Input
                id="reason"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="Wrong size, damaged in transit, …"
              />
            </div>
            <div>
              <FieldLabel htmlFor="notes">Notes</FieldLabel>
              <Textarea
                id="notes"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="(optional)"
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Lines</h2>
            <Button size="sm" variant="secondary" type="button" onClick={addLine}>
              <Plus className="h-3.5 w-3.5" /> Add line
            </Button>
          </CardHeader>
          <CardBody>
            {lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add at least one variant.</p>
            ) : (
              <div className="space-y-3">
                {lines.map((line, i) => (
                  <div key={i} className="grid grid-cols-[minmax(0,3fr)_minmax(0,1fr)_minmax(0,1.4fr)_auto] items-end gap-3">
                    <div>
                      <FieldLabel htmlFor={`v${i}`}>Variant</FieldLabel>
                      <Select
                        id={`v${i}`}
                        required
                        value={line.variantId}
                        onChange={(e) => updateLine(i, { variantId: e.target.value })}
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
                      <FieldLabel htmlFor={`c${i}`}>Condition</FieldLabel>
                      <Select
                        id={`c${i}`}
                        value={line.condition}
                        onChange={(e) => updateLine(i, { condition: e.target.value as ReturnCondition })}
                      >
                        {CONDITIONS.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </Select>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeLine(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <div className="flex items-center gap-3">
          <Button
            type="submit"
            loading={create.isPending}
            disabled={lines.length === 0 || !form.externalOrderId.trim()}
          >
            Open return
          </Button>
          <Link href="/returns">
            <Button type="button" variant="ghost">Cancel</Button>
          </Link>
        </div>
      </form>
    </AppShell>
  )
}
