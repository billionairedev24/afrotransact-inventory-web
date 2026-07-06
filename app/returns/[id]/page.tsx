"use client"

import Link from "next/link"
import { use, useMemo, useState } from "react"
import { ChevronLeft, Loader2 } from "lucide-react"
import { AppShell, PageHeader } from "@/components/layout/AppShell"
import { Card, CardBody, CardHeader } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { FieldLabel, Input, Select } from "@/components/ui/Input"
import { useReturn, useReturnActions, useStock } from "@/lib/queries"
import { fromCents, relativeTime } from "@/lib/format"
import type { ReturnCondition, ReturnDisposition, ReturnStatus } from "@/lib/api"

const TONE: Record<ReturnStatus, "info" | "warning" | "success" | "danger"> = {
  requested: "info",
  received:  "warning",
  processed: "success",
  cancelled: "danger",
}

const DISPOSITIONS: { value: ReturnDisposition; label: string; hint: string }[] = [
  { value: "restock",     label: "Restock",      hint: "Item back on the shelf; on_hand +qty" },
  { value: "scrap",       label: "Scrap",        hint: "Item discarded; no stock change" },
  { value: "refund_only", label: "Refund only",  hint: "No physical return (digital / lost / fraud)" },
]

const CONDITIONS: { value: ReturnCondition; label: string }[] = [
  { value: "new",       label: "New" },
  { value: "opened",    label: "Opened" },
  { value: "damaged",   label: "Damaged" },
  { value: "defective", label: "Defective" },
  { value: "unknown",   label: "Unknown" },
]

interface LineDraft {
  disposition: ReturnDisposition
  condition: ReturnCondition
  locationId: string
  refund: string
  notes: string
}

export default function ReturnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data, isLoading, isError } = useReturn(id)
  const stock = useStock()
  const defaultLocation = stock.data?.[0]?.location_id ?? ""
  const actions = useReturnActions(id)

  // Per-line draft state — operator's decisions waiting to be submitted.
  const [drafts, setDrafts] = useState<Record<string, LineDraft>>({})

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      </AppShell>
    )
  }
  if (isError || !data) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Return not found.</p>
      </AppShell>
    )
  }

  const lines = data.lines ?? []
  const editable = data.status === "requested" || data.status === "received"

  function getDraft(lineId: string, fallback: LineDraft): LineDraft {
    return drafts[lineId] ?? fallback
  }
  function setDraft(lineId: string, patch: Partial<LineDraft>) {
    setDrafts((d) => ({ ...d, [lineId]: { ...d[lineId], ...patch } }))
  }

  const summary = useMemo(() => {
    let restocking = 0
    let totalRefund = 0
    for (const l of lines) {
      const d = drafts[l.id]
      if (!d) continue
      if (d.disposition === "restock") restocking += l.quantity
      if (d.refund) totalRefund += Math.round(parseFloat(d.refund) * 100) || 0
    }
    return { restocking, totalRefund }
  }, [drafts, lines])

  async function submitProcess() {
    const payload = lines
      .map((l) => {
        const d = drafts[l.id]
        if (!d) return null
        const refund = d.refund ? Math.round(parseFloat(d.refund) * 100) : undefined
        return {
          line_id: l.id,
          disposition: d.disposition,
          condition: d.condition || undefined,
          location_id: d.disposition === "restock" ? (d.locationId || defaultLocation) : undefined,
          refund_amount_cents: refund,
          notes: d.notes.trim() || undefined,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x != null)
    if (payload.length === 0) return
    await actions.process.mutateAsync({ lines: payload })
    setDrafts({})
  }

  return (
    <AppShell>
      <Link
        href="/returns"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3"
      >
        <ChevronLeft className="h-4 w-4" /> Returns
      </Link>
      <PageHeader
        title={data.number}
        subtitle={`Order ${data.external_order_number || data.external_order_id.slice(0, 8)}${data.buyer_name ? ` • ${data.buyer_name}` : ""} • opened ${relativeTime(data.requested_at)}`}
        actions={<Badge tone={TONE[data.status]}>{data.status}</Badge>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold">Lines</h2>
            </CardHeader>
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold">Product</th>
                  <th className="px-5 py-3 text-left font-semibold">SKU</th>
                  <th className="px-5 py-3 text-right font-semibold">Qty</th>
                  <th className="px-5 py-3 text-left font-semibold">Condition</th>
                  {editable ? (
                    <>
                      <th className="px-5 py-3 text-left font-semibold">Disposition</th>
                      <th className="px-5 py-3 text-right font-semibold">Refund</th>
                    </>
                  ) : (
                    <>
                      <th className="px-5 py-3 text-left font-semibold">Disposition</th>
                      <th className="px-5 py-3 text-right font-semibold">Refund</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lines.map((l) => {
                  const d = editable
                    ? getDraft(l.id, {
                        disposition: "restock",
                        condition: l.condition,
                        locationId: defaultLocation,
                        refund: "",
                        notes: "",
                      })
                    : null
                  return (
                    <tr key={l.id}>
                      <td className="px-5 py-3 font-semibold text-foreground">{l.product_title}</td>
                      <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{l.variant_sku}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{l.quantity}</td>
                      <td className="px-5 py-3">
                        {editable && d ? (
                          <Select
                            value={d.condition}
                            onChange={(e) => setDraft(l.id, { condition: e.target.value as ReturnCondition })}
                            className="h-8 text-xs"
                          >
                            {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                          </Select>
                        ) : (
                          <span className="text-muted-foreground text-xs">{l.condition}</span>
                        )}
                      </td>
                      {editable && d ? (
                        <>
                          <td className="px-5 py-3">
                            <Select
                              value={d.disposition}
                              onChange={(e) => setDraft(l.id, { disposition: e.target.value as ReturnDisposition })}
                              className="h-8 text-xs"
                            >
                              {DISPOSITIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </Select>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={d.refund}
                              onChange={(e) => setDraft(l.id, { refund: e.target.value })}
                              placeholder="0.00"
                              className="h-8 w-24 text-right text-xs ml-auto"
                            />
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-5 py-3">
                            {l.disposition ? (
                              <Badge tone={l.disposition === "restock" ? "success" : l.disposition === "scrap" ? "danger" : "neutral"}>
                                {l.disposition.replace("_", " ")}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-right tabular-nums">
                            {l.refund_amount_cents != null ? fromCents(l.refund_amount_cents) : "—"}
                          </td>
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {editable && (
              <div className="border-t border-border bg-muted/30 px-5 py-3 flex items-center justify-end gap-3">
                <p className="text-xs text-muted-foreground">
                  {summary.restocking > 0
                    ? `Restocking ${summary.restocking} unit${summary.restocking === 1 ? "" : "s"} · `
                    : ""}
                  refunds total {fromCents(summary.totalRefund)}
                </p>
                <Button
                  loading={actions.process.isPending}
                  disabled={Object.keys(drafts).length === 0}
                  onClick={submitProcess}
                >
                  Process return
                </Button>
              </div>
            )}
          </Card>

          {data.reason && (
            <Card>
              <CardHeader>
                <h2 className="text-base font-semibold">Reason</h2>
              </CardHeader>
              <CardBody>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{data.reason}</p>
              </CardBody>
            </Card>
          )}

          {data.notes && (
            <Card>
              <CardHeader>
                <h2 className="text-base font-semibold">Notes</h2>
              </CardHeader>
              <CardBody>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{data.notes}</p>
              </CardBody>
            </Card>
          )}
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold">Actions</h2>
          </CardHeader>
          <CardBody className="space-y-3">
            {data.status === "requested" && (
              <Button
                className="w-full"
                loading={actions.markReceived.isPending}
                onClick={() => void actions.markReceived.mutateAsync()}
              >
                Mark received
              </Button>
            )}
            {editable && (
              <Button
                className="w-full"
                variant="danger"
                loading={actions.cancel.isPending}
                onClick={() => void actions.cancel.mutateAsync()}
              >
                Cancel return
              </Button>
            )}
            <div className="rounded-xl bg-muted/40 p-3 text-xs space-y-1.5">
              <KV label="Status" value={data.status} />
              <KV label="Requested" value={relativeTime(data.requested_at)} />
              {data.received_at && <KV label="Received" value={relativeTime(data.received_at)} />}
              {data.processed_at && <KV label="Processed" value={relativeTime(data.processed_at)} />}
              {data.rma_url && (
                <KV label="RMA label" value="open ↗" link={data.rma_url} />
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    </AppShell>
  )
}

function KV({ label, value, link }: { label: string; value: string; link?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer" className="text-foreground underline">
          {value}
        </a>
      ) : (
        <span className="text-foreground">{value}</span>
      )}
    </div>
  )
}
