"use client"

import Link from "next/link"
import { useState } from "react"
import { Loader2, Send } from "lucide-react"
import { AppShell, PageHeader } from "@/components/layout/AppShell"
import { Card } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { EmptyState } from "@/components/ui/EmptyState"
import { Table, TableKbdHint } from "@/components/ui/Table"
import { usePickTasks } from "@/lib/queries"
import type { PickTaskState, PickTask } from "@/lib/api"
import { relativeTime } from "@/lib/format"
import { useListNav } from "@/hooks/useListNav"

const FILTERS: { value: PickTaskState[]; label: string }[] = [
  { value: ["new", "picking", "packed"], label: "Open" },
  { value: ["new"],       label: "New" },
  { value: ["picking"],   label: "Picking" },
  { value: ["packed"],    label: "Packed" },
  { value: ["shipped"],   label: "Shipped" },
  { value: ["cancelled"], label: "Cancelled" },
]

const TONE: Record<PickTaskState, "neutral" | "success" | "warning" | "info" | "danger" | "gold"> = {
  new: "info",
  picking: "warning",
  packed: "gold",
  shipped: "success",
  cancelled: "danger",
}

export default function PickTasksPage() {
  const [filterIdx, setFilterIdx] = useState(0)
  const states = FILTERS[filterIdx].value
  const { data, isLoading, isError } = usePickTasks(states, 200)
  const rows: PickTask[] = data ?? []
  const activeIdx = useListNav<PickTask>(rows, (t) => `/pick-tasks/${t.id}`)

  return (
    <AppShell>
      <PageHeader
        title="Pick queue"
        subtitle="Inbound orders to fulfill. Updates every 15 seconds."
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
          <p className="px-5 py-4 text-sm text-red-800">Could not load pick tasks.</p>
        </Card>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Send}
          title="No tasks in this view"
          body="Inbound orders appear here as soon as the order-consumer ingests them."
        />
      ) : (
        <Table<PickTask>
          rows={rows}
          rowKey={(t) => t.id}
          activeIndex={activeIdx}
          defaultPageSize={50}
          searchPlaceholder="Search order number or buyer"
          searchMatch={(t, q) =>
            (t.external_order_number ?? "").toLowerCase().includes(q) ||
            t.external_order_id.toLowerCase().includes(q) ||
            (t.buyer_name ?? "").toLowerCase().includes(q)
          }
          rowActions={[
            { label: "Open",            onSelect: (t) => { window.location.href = `/pick-tasks/${t.id}` } },
            { label: "Copy order #",    onSelect: (t) => { void navigator.clipboard?.writeText(t.external_order_number || t.external_order_id) } },
            { label: "View on platform", onSelect: (t) => {
              const base = process.env.NEXT_PUBLIC_AFROTRANSACT_URL ?? "https://afrotransact.com"
              window.open(`${base}/orders/${t.external_order_id}`, "_blank")
            } },
          ]}
          footer={<TableKbdHint />}
          columns={[
            {
              key: "order",
              header: "Order #",
              cellClass: "font-mono text-xs",
              cell: (t) => (
                <Link href={`/pick-tasks/${t.id}`} className="hover:underline">
                  {t.external_order_number || t.external_order_id.slice(0, 8)}
                </Link>
              ),
            },
            { key: "buyer", header: "Buyer", cell: (t) => t.buyer_name || "—" },
            {
              key: "state",
              header: "State",
              cell: (t) => <Badge tone={TONE[t.state]}>{t.state}</Badge>,
            },
            {
              key: "created",
              header: "Created",
              cellClass: "text-xs text-muted-foreground",
              cell: (t) => relativeTime(t.created_at),
            },
            {
              key: "actions",
              header: "Actions",
              align: "right",
              srOnlyHeader: true,
              cell: (t) => (
                <Link href={`/pick-tasks/${t.id}`}>
                  <Button size="sm" variant="secondary">Open</Button>
                </Link>
              ),
            },
          ]}
        />
      )}
    </AppShell>
  )
}
