"use client"

import Link from "next/link"
import { use, useMemo, useState } from "react"
import { ChevronLeft, Loader2 } from "lucide-react"
import { AppShell, PageHeader } from "@/components/layout/AppShell"
import { Card, CardBody, CardHeader } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { usePurchaseOrder, usePOTransition } from "@/lib/queries"
import { usePrimaryHotkey } from "@/hooks/usePrimaryHotkey"
import { fromCents, relativeTime } from "@/lib/format"
import type { POStatus } from "@/lib/api"

const TONE: Record<POStatus, "neutral" | "info" | "warning" | "gold" | "success" | "danger"> = {
  draft:              "neutral",
  submitted:          "warning",
  approved:           "info",
  ordered:            "info",
  partially_received: "warning",
  received:           "success",
  cancelled:          "danger",
}

export default function PODetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data, isLoading, isError } = usePurchaseOrder(id)
  const t = usePOTransition(id)
  const [receiveDraft, setReceiveDraft] = useState<Record<string, number>>({})

  const totalToReceive = useMemo(
    () => Object.values(receiveDraft).reduce((a, b) => a + (b || 0), 0),
    [receiveDraft],
  )

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
        <p className="text-sm text-muted-foreground">PO not found.</p>
      </AppShell>
    )
  }

  const canReceive = data.status === "ordered" || data.status === "partially_received"

  async function submitReceive() {
    const lines = Object.entries(receiveDraft)
      .filter(([, qty]) => qty && qty > 0)
      .map(([line_id, quantity]) => ({ line_id, quantity }))
    if (lines.length === 0) return
    await t.receive.mutateAsync({ lines })
    setReceiveDraft({})
  }

  // ⌘/Ctrl+Enter fires the receive submit from anywhere on the page.
  usePrimaryHotkey(submitReceive, !canReceive || t.receive.isPending || totalToReceive === 0)

  return (
    <AppShell>
      <Link
        href="/receiving"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3"
      >
        <ChevronLeft className="h-4 w-4" /> Receiving
      </Link>
      <PageHeader
        title={data.number}
        subtitle={`${data.supplier_name} • created ${relativeTime(data.created_at)}`}
        actions={<Badge tone={TONE[data.status]}>{data.status.replace("_", " ")}</Badge>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-foreground">Lines</h2>
            </CardHeader>
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold">Product</th>
                  <th className="px-5 py-3 text-left font-semibold">SKU</th>
                  <th className="px-5 py-3 text-right font-semibold">Ordered</th>
                  <th className="px-5 py-3 text-right font-semibold">Received</th>
                  <th className="px-5 py-3 text-right font-semibold">Outstanding</th>
                  <th className="px-5 py-3 text-right font-semibold">Unit cost</th>
                  {canReceive && <th className="px-5 py-3 text-right font-semibold">Receive now</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(data.lines ?? []).map((l) => (
                  <tr key={l.id}>
                    <td className="px-5 py-3 font-semibold text-foreground">{l.product_title}</td>
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{l.variant_sku}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{l.quantity}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{l.received_qty}</td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {l.outstanding_qty === 0 ? (
                        <Badge tone="success">Done</Badge>
                      ) : (
                        <span className="font-semibold">{l.outstanding_qty}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">
                      {fromCents(l.unit_cost_cents)}
                    </td>
                    {canReceive && (
                      <td className="px-5 py-3 text-right">
                        <Input
                          type="number"
                          min={0}
                          max={l.outstanding_qty}
                          value={receiveDraft[l.id] ?? ""}
                          onChange={(e) =>
                            setReceiveDraft((d) => ({ ...d, [l.id]: parseInt(e.target.value || "0", 10) }))
                          }
                          disabled={l.outstanding_qty === 0}
                          className="h-9 w-24 text-right ml-auto"
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {canReceive && (
              <div className="border-t border-border bg-muted/30 px-5 py-3 flex items-center justify-end gap-3">
                <p className="text-xs text-muted-foreground">
                  {totalToReceive > 0
                    ? `Receiving ${totalToReceive} unit${totalToReceive === 1 ? "" : "s"}.`
                    : "Enter quantities above to receive."}
                </p>
                <Button
                  onClick={submitReceive}
                  loading={t.receive.isPending}
                  disabled={totalToReceive === 0}
                  title="⌘/Ctrl + Enter"
                >
                  Receive <span className="ml-1.5 text-[10px] opacity-70">⌘↵</span>
                </Button>
              </div>
            )}
          </Card>

          {data.notes && (
            <Card>
              <CardHeader>
                <h2 className="text-base font-semibold text-foreground">Notes</h2>
              </CardHeader>
              <CardBody>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{data.notes}</p>
              </CardBody>
            </Card>
          )}
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-foreground">Actions</h2>
          </CardHeader>
          <CardBody className="space-y-3">
            {data.status === "draft" && (
              <>
                <Button className="w-full" loading={t.submit.isPending} onClick={() => void t.submit.mutateAsync()}>
                  Submit for approval
                </Button>
                <p className="text-[11px] text-muted-foreground">
                  Under threshold → auto-approved and sent. Above → an
                  approver must sign off.
                </p>
                <Button className="w-full" variant="danger" loading={t.cancel.isPending} onClick={() => void t.cancel.mutateAsync()}>
                  Cancel draft
                </Button>
              </>
            )}
            {data.status === "submitted" && (
              <>
                <Button className="w-full" loading={t.approve.isPending} onClick={() => void t.approve.mutateAsync()}>
                  Approve & send to supplier
                </Button>
                <p className="text-[11px] text-muted-foreground">
                  Requires the <code className="font-mono">inventory:approve</code> permission.
                  Self-approval is blocked.
                </p>
                <Button className="w-full" variant="danger" loading={t.cancel.isPending} onClick={() => void t.cancel.mutateAsync()}>
                  Reject & cancel
                </Button>
              </>
            )}
            {(data.status === "ordered" || data.status === "partially_received") && (
              <Button className="w-full" variant="danger" loading={t.cancel.isPending} onClick={() => void t.cancel.mutateAsync()}>
                Cancel remaining
              </Button>
            )}
            <div className="rounded-xl bg-muted/40 p-3 text-xs space-y-1">
              <KV label="Total cost" value={fromCents(data.total_cost_cents)} mono />
              {data.expected_at && <KV label="Expected" value={new Date(data.expected_at).toLocaleDateString()} />}
              {data.ordered_at && <KV label="Ordered" value={relativeTime(data.ordered_at)} />}
              {data.received_at && <KV label="Received" value={relativeTime(data.received_at)} />}
              {data.supplier_ref && <KV label="Supplier ref" value={data.supplier_ref} mono />}
              {data.submitted_by && <KV label="Submitted by" value={data.submitted_by} />}
              {data.approved_by && <KV label="Approved by" value={data.approved_by} />}
            </div>
          </CardBody>
        </Card>
      </div>
    </AppShell>
  )
}

function KV({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-[11px] text-foreground" : "text-foreground"}>{value}</span>
    </div>
  )
}
