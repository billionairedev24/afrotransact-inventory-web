"use client"

import Link from "next/link"
import { use, useState } from "react"
import { Check, ChevronLeft, Loader2 } from "lucide-react"
import { AppShell, PageHeader } from "@/components/layout/AppShell"
import { Card, CardBody, CardHeader } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { FieldLabel, Input } from "@/components/ui/Input"
import { ScannerInput } from "@/components/ui/Scanner"
import { usePickTask, usePickTaskTransition } from "@/lib/queries"
import { usePrimaryHotkey } from "@/hooks/usePrimaryHotkey"
import { toast } from "sonner"
import { relativeTime } from "@/lib/format"
import type { PickTaskState } from "@/lib/api"

const TONE: Record<PickTaskState, "neutral" | "success" | "warning" | "info" | "danger" | "gold"> = {
  new: "info",
  picking: "warning",
  packed: "gold",
  shipped: "success",
  cancelled: "danger",
}

export default function PickTaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data, isLoading, isError } = usePickTask(id)
  const transitions = usePickTaskTransition(id)
  const [shipForm, setShipForm] = useState({ carrier: "", tracking_number: "", label_url: "" })
  // Scan-to-confirm picking. Track which lines the operator has scanned so
  // they can sanity-check before flipping the task to packed. Local state
  // only — the server-side state machine still owns the transition.
  const [picked, setPicked] = useState<Set<string>>(new Set())

  // Cmd/Ctrl+Enter fires the primary action for the current state —
  // start → pack → ship in one keystroke per stage.
  const primaryState = data?.state
  usePrimaryHotkey(() => {
    if (!primaryState) return
    if (primaryState === "new") return void transitions.startPicking.mutateAsync()
    if (primaryState === "picking") return void transitions.markPacked.mutateAsync()
    if (primaryState === "packed") return void transitions.ship.mutateAsync(shipForm)
  }, !primaryState || transitions.startPicking.isPending || transitions.markPacked.isPending || transitions.ship.isPending)

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
        <p className="text-sm text-muted-foreground">Pick task not found.</p>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <Link
        href="/pick-tasks"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3"
      >
        <ChevronLeft className="h-4 w-4" /> Pick queue
      </Link>
      <PageHeader
        title={`Order ${data.external_order_number || data.external_order_id.slice(0, 8)}`}
        subtitle={`Created ${relativeTime(data.created_at)}${data.buyer_name ? ` • ${data.buyer_name}` : ""}`}
        actions={<Badge tone={TONE[data.state]}>{data.state}</Badge>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-foreground">Lines</h2>
            </CardHeader>
            {data.state === "picking" && (
              <div className="px-5 pt-4">
                <FieldLabel>Scan to confirm pick</FieldLabel>
                <ScannerInput
                  onResolved={(v) => {
                    const match = (data.lines ?? []).find((l) => l.variant_id === v.variant_id)
                    if (!match) {
                      toast.error(`${v.sku} is not on this pick task`)
                      return
                    }
                    if (picked.has(match.id)) {
                      toast(`${v.sku} already confirmed`)
                      return
                    }
                    setPicked((s) => new Set(s).add(match.id))
                    toast.success(`${v.sku} confirmed`)
                  }}
                  placeholder="Scan a SKU on this task…"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {picked.size} of {(data.lines ?? []).length} confirmed
                </p>
              </div>
            )}
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  {data.state === "picking" && <th className="pl-5 py-3 w-6"></th>}
                  <th className="px-5 py-3 text-left font-semibold">Variant</th>
                  <th className="px-5 py-3 text-left font-semibold">Location</th>
                  <th className="px-5 py-3 text-right font-semibold">Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(data.lines ?? []).map((l) => (
                  <tr key={l.id} className={picked.has(l.id) ? "bg-emerald-50/40" : undefined}>
                    {data.state === "picking" && (
                      <td className="pl-5 py-3 w-6">
                        {picked.has(l.id) ? (
                          <Check className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <span className="block h-4 w-4 rounded-full border border-border" />
                        )}
                      </td>
                    )}
                    <td className="px-5 py-3 font-mono text-xs">{l.variant_id.slice(0, 8)}</td>
                    <td className="px-5 py-3 font-mono text-xs">{l.location_id.slice(0, 8)}</td>
                    <td className="px-5 py-3 text-right tabular-nums font-semibold">{l.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {data.state === "packed" || data.state === "picking" ? (
            <Card>
              <CardHeader>
                <h2 className="text-base font-semibold text-foreground">Ship</h2>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <FieldLabel htmlFor="carrier">Carrier</FieldLabel>
                    <Input id="carrier" value={shipForm.carrier} onChange={(e) => setShipForm({ ...shipForm, carrier: e.target.value })} placeholder="USPS / UPS / FedEx" />
                  </div>
                  <div>
                    <FieldLabel htmlFor="tracking">Tracking number</FieldLabel>
                    <Input id="tracking" value={shipForm.tracking_number} onChange={(e) => setShipForm({ ...shipForm, tracking_number: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <FieldLabel htmlFor="label">Label URL</FieldLabel>
                    <Input id="label" value={shipForm.label_url} onChange={(e) => setShipForm({ ...shipForm, label_url: e.target.value })} placeholder="(optional)" />
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button
                    loading={transitions.ship.isPending}
                    onClick={() => void transitions.ship.mutateAsync(shipForm)}
                  >
                    Ship & decrement stock
                  </Button>
                </div>
              </CardBody>
            </Card>
          ) : null}
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-foreground">Actions</h2>
          </CardHeader>
          <CardBody className="space-y-2">
            {data.state === "new" && (
              <Button
                className="w-full"
                loading={transitions.startPicking.isPending}
                onClick={() => void transitions.startPicking.mutateAsync()}
                title="⌘/Ctrl + Enter"
              >
                Start picking <span className="ml-1.5 text-[10px] opacity-70">⌘↵</span>
              </Button>
            )}
            {data.state === "picking" && (
              <Button
                className="w-full"
                loading={transitions.markPacked.isPending}
                onClick={() => void transitions.markPacked.mutateAsync()}
                title="⌘/Ctrl + Enter"
              >
                Mark packed <span className="ml-1.5 text-[10px] opacity-70">⌘↵</span>
              </Button>
            )}
            {(data.state === "new" || data.state === "picking") && (
              <Button
                className="w-full"
                variant="danger"
                loading={transitions.cancel.isPending}
                onClick={() => void transitions.cancel.mutateAsync()}
              >
                Cancel & release stock
              </Button>
            )}
            {data.state === "shipped" && data.tracking_number && (
              <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">{data.carrier ?? "Carrier"}</p>
                <p className="mt-1 font-mono">{data.tracking_number}</p>
                {data.label_url && (
                  <a href={data.label_url} className="mt-2 inline-block text-brand-gold-foreground underline" target="_blank" rel="noopener noreferrer">
                    Open label
                  </a>
                )}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </AppShell>
  )
}
