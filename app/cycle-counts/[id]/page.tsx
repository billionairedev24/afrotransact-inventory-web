"use client"

import Link from "next/link"
import { use, useMemo, useState } from "react"
import { ChevronLeft, Loader2 } from "lucide-react"
import { AppShell, PageHeader } from "@/components/layout/AppShell"
import { Card, CardBody, CardHeader } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { useCycleCount, useCycleCountActions } from "@/lib/queries"
import { relativeTime } from "@/lib/format"
import type { CycleCountStatus } from "@/lib/api"

const TONE: Record<CycleCountStatus, "warning" | "success" | "danger"> = {
  open: "warning",
  closed: "success",
  cancelled: "danger",
}

export default function CycleCountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data, isLoading, isError } = useCycleCount(id)
  const actions = useCycleCountActions(id)
  const [draft, setDraft] = useState<Record<string, string>>({})

  const totalVariance = useMemo(() => {
    if (!data?.lines) return 0
    return data.lines.reduce((acc, l) => acc + Math.abs(l.variance ?? 0), 0)
  }, [data])

  const uncounted = useMemo(
    () => (data?.lines ?? []).filter((l) => l.counted_qty == null).length,
    [data],
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
        <p className="text-sm text-muted-foreground">Cycle count not found.</p>
      </AppShell>
    )
  }

  const editable = data.status === "open"

  async function saveCounts() {
    const lines = Object.entries(draft)
      .filter(([, v]) => v !== "" && !Number.isNaN(parseInt(v, 10)))
      .map(([line_id, v]) => ({ line_id, counted_qty: parseInt(v, 10) }))
    if (lines.length === 0) return
    await actions.record.mutateAsync({ lines })
    setDraft({})
  }

  return (
    <AppShell>
      <Link
        href="/cycle-counts"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3"
      >
        <ChevronLeft className="h-4 w-4" /> Cycle counts
      </Link>
      <PageHeader
        title={`Count ${data.id.slice(0, 8)}`}
        subtitle={`Opened ${relativeTime(data.created_at)}${data.closed_at ? ` • closed ${relativeTime(data.closed_at)}` : ""}`}
        actions={<Badge tone={TONE[data.status]}>{data.status}</Badge>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6">
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-foreground">Lines</h2>
          </CardHeader>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 text-left font-semibold">Product</th>
                <th className="px-5 py-3 text-left font-semibold">SKU</th>
                <th className="px-5 py-3 text-right font-semibold">Expected</th>
                <th className="px-5 py-3 text-right font-semibold">Counted</th>
                <th className="px-5 py-3 text-right font-semibold">Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(data.lines ?? []).map((l) => {
                const variance = l.variance ?? null
                return (
                  <tr key={l.id}>
                    <td className="px-5 py-3 font-semibold text-foreground">{l.product_title}</td>
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{l.variant_sku}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{l.expected_qty}</td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {editable ? (
                        <Input
                          type="number"
                          min={0}
                          value={draft[l.id] ?? l.counted_qty ?? ""}
                          onChange={(e) => setDraft((d) => ({ ...d, [l.id]: e.target.value }))}
                          className="h-9 w-24 text-right ml-auto"
                        />
                      ) : (
                        l.counted_qty ?? "—"
                      )}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {variance == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : variance === 0 ? (
                        <Badge tone="success">0</Badge>
                      ) : variance > 0 ? (
                        <Badge tone="info">+{variance}</Badge>
                      ) : (
                        <Badge tone="danger">{variance}</Badge>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {editable && (
            <div className="border-t border-border bg-muted/30 px-5 py-3 flex items-center justify-end gap-3">
              <p className="text-xs text-muted-foreground">
                {Object.keys(draft).length > 0
                  ? `${Object.keys(draft).length} line${Object.keys(draft).length === 1 ? "" : "s"} edited.`
                  : "Enter counted quantities above."}
              </p>
              <Button onClick={saveCounts} loading={actions.record.isPending} disabled={Object.keys(draft).length === 0}>
                Save counts
              </Button>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-foreground">Summary</h2>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="rounded-xl bg-muted/40 p-3 text-xs space-y-1.5">
              <KV label="Lines" value={String(data.lines?.length ?? 0)} />
              <KV label="Uncounted" value={String(uncounted)} />
              <KV label="Total variance" value={String(totalVariance)} />
            </div>
            {editable && (
              <>
                <Button
                  className="w-full"
                  loading={actions.close.isPending}
                  disabled={uncounted > 0}
                  onClick={() => void actions.close.mutateAsync()}
                >
                  Close & post corrections
                </Button>
                <Button
                  className="w-full"
                  variant="danger"
                  loading={actions.cancel.isPending}
                  onClick={() => void actions.cancel.mutateAsync()}
                >
                  Cancel count
                </Button>
                {uncounted > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    {uncounted} line{uncounted === 1 ? "" : "s"} still need a counted quantity before close.
                  </p>
                )}
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </AppShell>
  )
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  )
}
