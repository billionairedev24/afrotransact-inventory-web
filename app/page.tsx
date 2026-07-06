"use client"

import Link from "next/link"
import {
  AlertTriangle,
  ArrowRight,
  Box,
  ClipboardCheck,
  Activity,
  RotateCcw,
  Send,
  Truck,
  Warehouse,
} from "lucide-react"
import { AppShell, PageHeader } from "@/components/layout/AppShell"
import { Card, CardHeader, CardBody } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { StatCard } from "@/components/ui/StatCard"
import { Table } from "@/components/ui/Table"
import { MovementsSparkline } from "@/components/dashboard/MovementsSparkline"
import { useDashboard } from "@/lib/queries"
import { fromCents, relativeTime } from "@/lib/format"

/**
 * Inventory operations dashboard.
 *
 * Fan-out via `useDashboard()` — six queries in parallel; isLoading lifts
 * once the slowest resolves. Tiles are clickable drill-downs; previews
 * below show the actual top-N rows so an operator can act without
 * leaving the page.
 */
export default function DashboardPage() {
  const dash = useDashboard()

  // Derive the rollups locally so the tiles can render the moment the
  // underlying lists land — no second roundtrip.
  const lowStockRows  = dash.stock.filter((s) => s.available > 0 && s.available <= 5)
  const outOfStockRows = dash.stock.filter((s) => s.on_hand === 0)
  const pickByState = dash.openPicks.reduce<Record<string, number>>((acc, t) => {
    acc[t.state] = (acc[t.state] ?? 0) + 1
    return acc
  }, {})

  return (
    <AppShell>
      <PageHeader
        title="Operations"
        subtitle="Today's queue + warehouse health at a glance."
      />

      {/* ── Hero stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard
          label="Open picks"
          value={dash.openPicks.length}
          icon={Send}
          tone={dash.openPicks.length > 0 ? "info" : "default"}
          href="/pick-tasks"
          hint={
            dash.openPicks.length === 0
              ? "Queue clear"
              : `${pickByState.new ?? 0} new · ${pickByState.picking ?? 0} picking · ${pickByState.packed ?? 0} packed`
          }
          loading={dash.isLoading}
        />
        <StatCard
          label="Out of stock"
          value={outOfStockRows.length}
          icon={AlertTriangle}
          tone={outOfStockRows.length > 0 ? "danger" : "success"}
          href="/stock"
          hint={
            outOfStockRows.length === 0
              ? "All SKUs in stock"
              : `${lowStockRows.length} more running low (≤5)`
          }
          loading={dash.isLoading}
        />
        <StatCard
          label="Inbound POs"
          value={dash.openPOs.length}
          icon={Truck}
          tone={dash.openPOs.length > 0 ? "warning" : "default"}
          href="/receiving"
          hint={
            dash.openPOs.length === 0
              ? "No POs awaiting receipt"
              : `${fromCents(dash.openPOs.reduce((s, p) => s + p.total_cost_cents, 0))} on order`
          }
          loading={dash.isLoading}
        />
        <StatCard
          label="Pending returns"
          value={dash.openReturns.length}
          icon={RotateCcw}
          tone={dash.openReturns.length > 0 ? "warning" : "default"}
          href="/returns"
          hint={dash.openReturns.length === 0 ? "No returns to process" : "Inspect or process"}
          loading={dash.isLoading}
        />
        <StatCard
          label="Cycle counts"
          value={dash.openCycleCounts.length}
          icon={ClipboardCheck}
          tone={dash.openCycleCounts.length > 0 ? "info" : "default"}
          href="/cycle-counts"
          hint={dash.openCycleCounts.length === 0 ? "No active counts" : "Open today"}
          loading={dash.isLoading}
        />
        <StatCard
          label="Products"
          value={dash.products.length}
          icon={Box}
          href="/products"
          hint={`${dash.stock.length} SKU rows tracked`}
          loading={dash.isLoading}
        />
      </div>

      {/* ── Action grid: pick queue + low-stock side by side ── */}
      <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Today&rsquo;s pick queue</h2>
            </div>
            <Link
              href="/pick-tasks"
              className="text-xs font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              Open queue <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <Table
            columns={[
              { key: "order", header: "Order",
                cell: (t) => (
                  <Link href={`/pick-tasks/${t.id}`} className="font-mono text-xs hover:underline">
                    {t.external_order_number || t.external_order_id.slice(0, 8)}
                  </Link>
                ),
              },
              { key: "buyer", header: "Buyer", cell: (t) => t.buyer_name || "—" },
              { key: "state", header: "State",
                cell: (t) => (
                  <Badge tone={t.state === "packed" ? "gold" : t.state === "picking" ? "warning" : "info"}>
                    {t.state}
                  </Badge>
                ),
              },
              { key: "age", header: "Aged", align: "right", cellClass: "text-xs text-muted-foreground",
                cell: (t) => relativeTime(t.created_at),
              },
            ]}
            rows={dash.openPicks.slice(0, 6)}
            rowKey={(t) => t.id}
            empty="Queue is clear 🎉"
            className="rounded-t-none border-t-0"
          />
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Stock to top up</h2>
            </div>
            <Link
              href="/stock"
              className="text-xs font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              All stock <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <Table
            columns={[
              { key: "title", header: "Product",
                cell: (s) => <span className="font-medium text-foreground line-clamp-1">{s.product_title}</span>,
              },
              { key: "sku",  header: "SKU", cellClass: "font-mono text-xs text-muted-foreground",
                cell: (s) => s.variant_sku },
              { key: "loc",  header: "Loc",  cellClass: "text-xs text-muted-foreground",
                cell: (s) => s.location_code },
              { key: "avail", header: "Available", align: "right",
                cell: (s) => (
                  <Badge tone={s.on_hand === 0 ? "danger" : "warning"}>
                    {s.available}
                  </Badge>
                ),
              },
            ]}
            rows={[...outOfStockRows, ...lowStockRows].slice(0, 6)}
            rowKey={(s) => `${s.variant_id}:${s.location_id}`}
            empty="Every SKU is stocked"
            className="rounded-t-none border-t-0"
          />
        </Card>
      </div>

      {/* ── Inbound + Returns + Cycle Counts row ── */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Inbound</h2>
            </div>
          </CardHeader>
          {dash.openPOs.length === 0 ? (
            <CardBody>
              <p className="text-sm text-muted-foreground">No POs awaiting receipt.</p>
            </CardBody>
          ) : (
            <ul className="divide-y divide-border">
              {dash.openPOs.slice(0, 5).map((po) => (
                <li key={po.id}>
                  <Link
                    href={`/receiving/${po.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/30"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{po.supplier_name}</p>
                      <p className="text-[11px] font-mono text-muted-foreground">{po.number}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs tabular-nums">{fromCents(po.total_cost_cents)}</p>
                      <p className="text-[10px] text-muted-foreground">{po.status.replace("_", " ")}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Returns to action</h2>
            </div>
          </CardHeader>
          {dash.openReturns.length === 0 ? (
            <CardBody>
              <p className="text-sm text-muted-foreground">No open returns.</p>
            </CardBody>
          ) : (
            <ul className="divide-y divide-border">
              {dash.openReturns.slice(0, 5).map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/returns/${r.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/30"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{r.number}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{r.buyer_name || r.reason || "—"}</p>
                    </div>
                    <Badge tone={r.status === "received" ? "warning" : "info"}>{r.status}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Stock movements · 7 days</h2>
            </div>
          </CardHeader>
          <CardBody>
            <MovementsSparkline movements={dash.movements} />
            {dash.movements.length === 0 && (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                No stock movements yet — receive a PO or process a return to see activity.
              </p>
            )}
          </CardBody>
        </Card>
      </div>
    </AppShell>
  )
}
