"use client"

import Link from "next/link"
import { useState } from "react"
import { Loader2, Plus, RotateCcw } from "lucide-react"
import { AppShell, PageHeader } from "@/components/layout/AppShell"
import { Card } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { EmptyState } from "@/components/ui/EmptyState"
import { useReturns } from "@/lib/queries"
import type { ReturnStatus, ReturnModel } from "@/lib/api"
import { relativeTime } from "@/lib/format"
import { useListNav } from "@/hooks/useListNav"
import { Table, TableKbdHint } from "@/components/ui/Table"

const FILTERS: { value: ReturnStatus[]; label: string }[] = [
  { value: ["requested", "received"], label: "Open" },
  { value: ["requested"],              label: "Requested" },
  { value: ["received"],               label: "Received" },
  { value: ["processed"],              label: "Processed" },
  { value: ["cancelled"],              label: "Cancelled" },
]

const TONE: Record<ReturnStatus, "info" | "warning" | "success" | "danger"> = {
  requested: "info",
  received:  "warning",
  processed: "success",
  cancelled: "danger",
}

export default function ReturnsPage() {
  const [filterIdx, setFilterIdx] = useState(0)
  const statuses = FILTERS[filterIdx].value
  const { data, isLoading, isError } = useReturns(statuses, 200)
  const rows = data ?? []
  const activeIdx = useListNav<ReturnModel>(rows, (r) => `/returns/${r.id}`)

  return (
    <AppShell>
      <PageHeader
        title="Returns"
        subtitle="Buyer returns awaiting inspection or processing."
        actions={
          <Link href="/returns/new">
            <Button>
              <Plus className="h-4 w-4" /> New return
            </Button>
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f, i) => (
          <Button
            key={f.label}
            size="sm"
            variant={i === filterIdx ? "primary" : "secondary"}
            onClick={() => setFilterIdx(i)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : isError ? (
        <Card className="border-red-200 bg-red-50/50">
          <p className="px-5 py-4 text-sm text-red-800">Could not load returns.</p>
        </Card>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={RotateCcw}
          title="No returns in this view"
          body="Opens here when AT order-service sends a return event, or when an operator records one manually."
          action={
            <Link href="/returns/new">
              <Button><Plus className="h-4 w-4" /> New return</Button>
            </Link>
          }
        />
      ) : (
        <Table<ReturnModel>
          rows={rows}
          rowKey={(r) => r.id}
          activeIndex={activeIdx}
          defaultPageSize={50}
          searchPlaceholder="Search RMA #, order #, or buyer"
          searchMatch={(r, q) =>
            r.number.toLowerCase().includes(q) ||
            (r.external_order_number ?? "").toLowerCase().includes(q) ||
            (r.buyer_name ?? "").toLowerCase().includes(q)
          }
          rowActions={[
            { label: "Open",         onSelect: (r) => { window.location.href = `/returns/${r.id}` } },
            { label: "Copy RMA #",   onSelect: (r) => { void navigator.clipboard?.writeText(r.number) } },
            { label: "Open order",   onSelect: (r) => {
              const base = process.env.NEXT_PUBLIC_AFROTRANSACT_URL ?? "https://afrotransact.com"
              window.open(`${base}/orders/${r.external_order_id}`, "_blank")
            } },
          ]}
          footer={<TableKbdHint />}
          columns={[
            {
              key: "number", header: "RMA #", cellClass: "font-mono text-xs",
              cell: (r) => (
                <Link href={`/returns/${r.id}`} className="hover:underline font-semibold">{r.number}</Link>
              ),
            },
            { key: "order",  header: "Order #",  cellClass: "font-mono text-xs text-muted-foreground", cell: (r) => r.external_order_number || r.external_order_id.slice(0, 8) },
            { key: "buyer",  header: "Buyer",    cell: (r) => r.buyer_name || "—" },
            { key: "reason", header: "Reason",   cellClass: "text-muted-foreground", cell: (r) => r.reason || "—" },
            { key: "status", header: "Status",   cell: (r) => <Badge tone={TONE[r.status]}>{r.status}</Badge> },
            { key: "req",    header: "Requested",cellClass: "text-xs text-muted-foreground", cell: (r) => relativeTime(r.requested_at) },
            {
              key: "actions", header: "Actions", align: "right", srOnlyHeader: true,
              cell: (r) => (
                <Link href={`/returns/${r.id}`}><Button size="sm" variant="secondary">Open</Button></Link>
              ),
            },
          ]}
        />
      )}
    </AppShell>
  )
}
