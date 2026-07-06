"use client"

import Link from "next/link"
import { useState } from "react"
import { Loader2, Plus, Truck } from "lucide-react"
import { AppShell, PageHeader } from "@/components/layout/AppShell"
import { Card } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { EmptyState } from "@/components/ui/EmptyState"
import { usePurchaseOrders } from "@/lib/queries"
import type { POStatus, PurchaseOrder } from "@/lib/api"
import { fromCents, relativeTime } from "@/lib/format"
import { useListNav } from "@/hooks/useListNav"
import { Table, TableKbdHint } from "@/components/ui/Table"

const FILTERS: { value: POStatus[]; label: string }[] = [
  { value: ["draft", "ordered", "partially_received"], label: "Open" },
  { value: ["draft"],              label: "Draft" },
  { value: ["ordered"],            label: "Ordered" },
  { value: ["partially_received"], label: "Partial" },
  { value: ["received"],           label: "Received" },
  { value: ["cancelled"],          label: "Cancelled" },
]

const TONE: Record<POStatus, "neutral" | "info" | "warning" | "gold" | "success" | "danger"> = {
  draft:              "neutral",
  submitted:          "warning",
  approved:           "info",
  ordered:            "info",
  partially_received: "warning",
  received:           "success",
  cancelled:          "danger",
}

export default function ReceivingPage() {
  const [filterIdx, setFilterIdx] = useState(0)
  const statuses = FILTERS[filterIdx].value
  const { data, isLoading, isError } = usePurchaseOrders(statuses, 200)
  const rows = data ?? []
  const activeIdx = useListNav<PurchaseOrder>(rows, (po) => `/receiving/${po.id}`)

  return (
    <AppShell>
      <PageHeader
        title="Receiving"
        subtitle="Purchase orders waiting on supplier deliveries."
        actions={
          <Link href="/receiving/new">
            <Button>
              <Plus className="h-4 w-4" /> New PO
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
          <p className="px-5 py-4 text-sm text-red-800">Could not load purchase orders.</p>
        </Card>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No POs in this view"
          body="Create a draft, add the SKUs you're ordering from the supplier, then approve to lock it in."
          action={
            <Link href="/receiving/new">
              <Button>
                <Plus className="h-4 w-4" /> New PO
              </Button>
            </Link>
          }
        />
      ) : (
        <Table<PurchaseOrder>
          rows={rows}
          rowKey={(po) => po.id}
          activeIndex={activeIdx}
          defaultPageSize={50}
          searchPlaceholder="Search PO #, supplier, or status"
          searchMatch={(po, q) =>
            po.number.toLowerCase().includes(q) ||
            po.supplier_name.toLowerCase().includes(q) ||
            po.status.toLowerCase().includes(q)
          }
          rowActions={[
            { label: "Open",         onSelect: (po) => { window.location.href = `/receiving/${po.id}` } },
            { label: "Copy PO #",    onSelect: (po) => { void navigator.clipboard?.writeText(po.number) } },
            { label: "Duplicate as draft", onSelect: () => { /* TODO: clone endpoint */ } },
          ]}
          footer={<TableKbdHint />}
          columns={[
            {
              key: "number", header: "PO #", cellClass: "font-mono text-xs",
              cell: (po) => (
                <Link href={`/receiving/${po.id}`} className="hover:underline font-semibold">{po.number}</Link>
              ),
            },
            { key: "supplier", header: "Supplier", cell: (po) => po.supplier_name },
            { key: "status",   header: "Status",   cell: (po) => <Badge tone={TONE[po.status]}>{po.status.replace("_", " ")}</Badge> },
            { key: "total",    header: "Total",    align: "right", cellClass: "tabular-nums", cell: (po) => fromCents(po.total_cost_cents) },
            { key: "updated",  header: "Updated",  cellClass: "text-xs text-muted-foreground", cell: (po) => relativeTime(po.updated_at) },
            {
              key: "actions", header: "Actions", align: "right", srOnlyHeader: true,
              cell: (po) => (
                <Link href={`/receiving/${po.id}`}><Button size="sm" variant="secondary">Open</Button></Link>
              ),
            },
          ]}
        />
      )}
    </AppShell>
  )
}
