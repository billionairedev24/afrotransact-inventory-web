"use client"

import Link from "next/link"
import { useState } from "react"
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Search,
} from "lucide-react"
import { AppShell, PageHeader } from "@/components/layout/AppShell"
import { Card } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { EmptyState } from "@/components/ui/EmptyState"
import { Table } from "@/components/ui/Table"
import { useCatalogAdminList, type CatalogItemStatus } from "@/lib/queries"
import type { CatalogItemAdmin } from "@/lib/api"
import { relativeTime } from "@/lib/format"

const STATUS_TONE: Record<CatalogItemStatus, "warning" | "success" | "danger"> = {
  draft: "warning",
  published: "success",
  suppressed: "danger",
}

const FILTERS: { value: "" | CatalogItemStatus; label: string }[] = [
  { value: "",           label: "All" },
  { value: "draft",      label: "Draft" },
  { value: "published",  label: "Published" },
  { value: "suppressed", label: "Suppressed" },
]

export default function CatalogListPage() {
  const [q, setQ] = useState("")
  const [statusFilter, setStatusFilter] = useState<"" | CatalogItemStatus>("")
  const [page, setPage] = useState(0)
  const size = 25
  const { data, isLoading, isError, error } = useCatalogAdminList({
    q: q || undefined,
    status: statusFilter || undefined,
    page,
    size,
  })

  const rows = data?.content ?? []
  const totalPages = data?.totalPages ?? 0
  const totalElements = data?.totalElements ?? 0

  return (
    <AppShell>
      <PageHeader
        title="Catalog"
        subtitle="Master listings (ASIN-equivalent). Sellers and AT-Inv attach offers against these."
        actions={
          <Link href="/catalog/new">
            <Button>
              <Plus className="h-4 w-4" /> New item
            </Button>
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(0) }}
            placeholder="Search title or item number"
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <Button
              key={f.label}
              size="sm"
              variant={statusFilter === f.value ? "primary" : "secondary"}
              onClick={() => { setStatusFilter(f.value); setPage(0) }}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading catalog items…
        </div>
      ) : isError ? (
        <Card className="border-red-200 bg-red-50/50">
          <p className="px-5 py-4 text-sm text-red-800">
            Could not load catalog items{error instanceof Error ? `: ${error.message}` : ""}.
          </p>
        </Card>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={q || statusFilter ? "No matches" : "No catalog items yet"}
          body={q || statusFilter ? "Try a different filter." : "Create the first item to start attaching offers."}
          action={
            !q && !statusFilter && (
              <Link href="/catalog/new">
                <Button><Plus className="h-4 w-4" /> New item</Button>
              </Link>
            )
          }
        />
      ) : (
        <Table<CatalogItemAdmin>
          rows={rows}
          rowKey={(it) => it.id}
          columns={[
            {
              key: "num", header: "Item #", cellClass: "font-mono text-xs",
              cell: (it) => <Link href={`/catalog/${it.id}`} className="hover:underline">{it.itemNumber}</Link>,
            },
            {
              key: "title", header: "Title", cellClass: "font-semibold text-foreground",
              cell: (it) => <Link href={`/catalog/${it.id}`} className="hover:underline">{it.title}</Link>,
            },
            { key: "brand",    header: "Brand",    cellClass: "text-muted-foreground", cell: (it) => it.brand ?? "—" },
            { key: "status",   header: "Status",   cell: (it) => <Badge tone={STATUS_TONE[it.status]}>{it.status}</Badge> },
            { key: "variants", header: "Variants", align: "right", cellClass: "tabular-nums", cell: (it) => it.variants?.length ?? 0 },
            { key: "images",   header: "Images",   align: "right", cellClass: "tabular-nums", cell: (it) => it.images?.length ?? 0 },
            { key: "updated",  header: "Updated",  cellClass: "text-xs text-muted-foreground", cell: (it) => relativeTime(it.updatedAt) },
          ]}
          footer={
            totalPages > 1 && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">
                  Page {page + 1} of {totalPages} • {totalElements} item{totalElements === 1 ? "" : "s"}
                </span>
                <span className="flex gap-2">
                  <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                    <ChevronLeft className="h-3.5 w-3.5" /> Prev
                  </Button>
                  <Button size="sm" variant="secondary" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                    Next <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </span>
              </div>
            )
          }
        />
      )}
    </AppShell>
  )
}
