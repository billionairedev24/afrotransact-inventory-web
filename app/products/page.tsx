"use client"

import Link from "next/link"
import { useState } from "react"
import { Box, Plus, Search, Loader2 } from "lucide-react"
import { AppShell, PageHeader } from "@/components/layout/AppShell"
import { Card } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { EmptyState } from "@/components/ui/EmptyState"
import { Table, TableKbdHint } from "@/components/ui/Table"
import { useProducts } from "@/lib/queries"
import type { ProductStatus, Product } from "@/lib/api"
import { relativeTime } from "@/lib/format"
import { useListNav } from "@/hooks/useListNav"

const STATUS_TONE: Record<ProductStatus, "neutral" | "success" | "warning"> = {
  draft: "warning",
  active: "success",
  retired: "neutral",
}

export default function ProductsPage() {
  const { data, isLoading, isError, error } = useProducts()
  const [q, setQ] = useState("")
  const term = q.trim().toLowerCase()
  const rows: Product[] = (data ?? []).filter(
    (p) =>
      !term ||
      p.title.toLowerCase().includes(term) ||
      p.sku.toLowerCase().includes(term) ||
      (p.brand ?? "").toLowerCase().includes(term),
  )
  const activeIdx = useListNav<Product>(rows, (p) => `/products/${p.id}`)

  return (
    <AppShell>
      <PageHeader
        title="Products"
        subtitle="Offers AT-Inv stocks. Pick from the platform catalog for the Amazon-style flow; legacy 'new product' kept while we cut over."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/products/from-catalog">
              <Button>
                <Plus className="h-4 w-4" />
                From catalog
              </Button>
            </Link>
            <Link href="/products/new">
              <Button variant="secondary">Legacy: new product</Button>
            </Link>
          </div>
        }
      />

      <div className="mb-4 max-w-md relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title, SKU, or brand"
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading products…
        </div>
      ) : isError ? (
        <Card className="border-red-200 bg-red-50/50">
          <p className="px-5 py-4 text-sm text-red-800">
            Could not load products: {(error as { detail?: string })?.detail ?? "unknown error"}
          </p>
        </Card>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Box}
          title={term ? "No products match" : "No products yet"}
          body={term ? "Try a different search term." : "Create your first product to start stocking it."}
          action={
            !term && (
              <Link href="/products/new">
                <Button>
                  <Plus className="h-4 w-4" /> New product
                </Button>
              </Link>
            )
          }
        />
      ) : (
        <Table<Product>
          rows={rows}
          rowKey={(p) => p.id}
          activeIndex={activeIdx}
          defaultPageSize={50}
          searchPlaceholder="Search title, SKU, or brand"
          searchMatch={(p, q) =>
            p.title.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q) ||
            (p.brand ?? "").toLowerCase().includes(q)
          }
          selectable
          bulkActions={(selected, clear) => (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                // Bulk-publish stub. Real impl would call useUpdateProduct
                // per row inside a Promise.all + invalidate products list.
                alert(`Would publish ${selected.length} products`)
                clear()
              }}
            >
              Publish
            </Button>
          )}
          rowActions={[
            { label: "Open",             onSelect: (p) => { window.location.href = `/products/${p.id}` } },
            { label: "View stock",       onSelect: (p) => { window.location.href = `/stock?q=${encodeURIComponent(p.sku)}` } },
            { label: "View movements",   onSelect: (p) => { window.location.href = `/reports?tab=movements&q=${encodeURIComponent(p.sku)}` } },
            { label: "Copy SKU",         onSelect: (p) => { void navigator.clipboard?.writeText(p.sku) } },
            { label: "Open on storefront", onSelect: (p) => {
              const base = process.env.NEXT_PUBLIC_AFROTRANSACT_URL ?? "https://afrotransact.com"
              window.open(`${base}/product/${p.id}`, "_blank")
            } },
          ]}
          footer={<TableKbdHint />}
          columns={[
            {
              key: "title",
              header: "Title",
              cell: (p) => (
                <Link href={`/products/${p.id}`} className="font-semibold text-foreground hover:underline">
                  {p.title}
                </Link>
              ),
            },
            { key: "sku",     header: "SKU",     cellClass: "font-mono text-xs text-muted-foreground", cell: (p) => p.sku },
            { key: "brand",   header: "Brand",   cellClass: "text-muted-foreground",                   cell: (p) => p.brand ?? "—" },
            { key: "status",  header: "Status",  cell: (p) => <Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge> },
            { key: "updated", header: "Updated", cellClass: "text-xs text-muted-foreground",           cell: (p) => relativeTime(p.updated_at) },
          ]}
        />
      )}
    </AppShell>
  )
}
