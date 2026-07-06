"use client"

import Link from "next/link"
import { useState } from "react"
import { ClipboardCheck, Loader2, Plus } from "lucide-react"
import { AppShell, PageHeader } from "@/components/layout/AppShell"
import { Card } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { EmptyState } from "@/components/ui/EmptyState"
import { Table, TableKbdHint } from "@/components/ui/Table"
import { useCycleCounts } from "@/lib/queries"
import type { CycleCountStatus, CycleCount } from "@/lib/api"
import { relativeTime } from "@/lib/format"
import { useListNav } from "@/hooks/useListNav"

const FILTERS: { value: CycleCountStatus[]; label: string }[] = [
  { value: ["open"],      label: "Open" },
  { value: ["closed"],    label: "Closed" },
  { value: ["cancelled"], label: "Cancelled" },
  { value: [],            label: "All" },
]

const TONE: Record<CycleCountStatus, "warning" | "success" | "danger"> = {
  open: "warning",
  closed: "success",
  cancelled: "danger",
}

export default function CycleCountsPage() {
  const [filterIdx, setFilterIdx] = useState(0)
  const statuses = FILTERS[filterIdx].value
  const { data, isLoading, isError } = useCycleCounts(statuses.length ? statuses : undefined, 200)
  const rows: CycleCount[] = data ?? []
  const activeIdx = useListNav<CycleCount>(rows, (c) => `/cycle-counts/${c.id}`)

  return (
    <AppShell>
      <PageHeader
        title="Cycle counts"
        subtitle="Reconcile the system count against what's physically on the shelf."
        actions={
          <Link href="/cycle-counts/new">
            <Button>
              <Plus className="h-4 w-4" /> New count
            </Button>
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f, i) => (
          <Button key={f.label} size="sm" variant={i === filterIdx ? "primary" : "secondary"} onClick={() => setFilterIdx(i)}>
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
          <p className="px-5 py-4 text-sm text-red-800">Could not load cycle counts.</p>
        </Card>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No cycle counts in this view"
          body="Open a count to snapshot expected quantities, then walk the warehouse and reconcile."
          action={
            <Link href="/cycle-counts/new">
              <Button>
                <Plus className="h-4 w-4" /> New count
              </Button>
            </Link>
          }
        />
      ) : (
        <Table<CycleCount>
          rows={rows}
          rowKey={(c) => c.id}
          activeIndex={activeIdx}
          defaultPageSize={50}
          searchPlaceholder="Search by id or status"
          searchMatch={(c, q) => c.id.toLowerCase().includes(q) || c.status.toLowerCase().includes(q)}
          rowActions={[
            { label: "Open",       onSelect: (c) => { window.location.href = `/cycle-counts/${c.id}` } },
            { label: "Copy id",    onSelect: (c) => { void navigator.clipboard?.writeText(c.id) } },
          ]}
          footer={<TableKbdHint />}
          columns={[
            {
              key: "id", header: "ID", cellClass: "font-mono text-xs",
              cell: (c) => (
                <Link href={`/cycle-counts/${c.id}`} className="hover:underline">{c.id.slice(0, 8)}</Link>
              ),
            },
            { key: "status", header: "Status", cell: (c) => <Badge tone={TONE[c.status]}>{c.status}</Badge> },
            { key: "opened", header: "Opened", cellClass: "text-xs text-muted-foreground", cell: (c) => relativeTime(c.created_at) },
            { key: "closed", header: "Closed", cellClass: "text-xs text-muted-foreground", cell: (c) => c.closed_at ? relativeTime(c.closed_at) : "—" },
            {
              key: "actions", header: "Actions", align: "right", srOnlyHeader: true,
              cell: (c) => (
                <Link href={`/cycle-counts/${c.id}`}><Button size="sm" variant="secondary">Open</Button></Link>
              ),
            },
          ]}
        />
      )}
    </AppShell>
  )
}
