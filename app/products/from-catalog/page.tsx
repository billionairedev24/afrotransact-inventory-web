"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, Loader2, Search } from "lucide-react"
import { AppShell, PageHeader } from "@/components/layout/AppShell"
import { Card, CardBody, CardHeader } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { FieldLabel, Input } from "@/components/ui/Input"
import {
  useCatalogSearch,
  useCreateOfferFromCatalog,
  useStock,
} from "@/lib/queries"
import { fromCents } from "@/lib/format"
import type { CatalogItem, CatalogVariant } from "@/lib/api"

/**
 * Operator workflow — pick a catalog item and create an AT-Inv offer
 * with initial stock. Catalog data (title, images, description) is
 * read-only; operator only enters cost / list price / initial stock.
 *
 * Mirrors the seller dashboard flow in afrotransact-v2-ui but the form
 * is operations-flavored: cost, currency, location, opening stock.
 */
export default function NewFromCatalogPage() {
  const [query, setQuery] = useState("")
  const [picked, setPicked] = useState<CatalogItem | null>(null)

  return (
    <AppShell>
      <Link
        href="/products"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3"
      >
        <ChevronLeft className="h-4 w-4" /> Products
      </Link>
      <PageHeader
        title="New offer from catalog"
        subtitle="Pick a published catalog item and record an inventory offer + opening stock. Marketing data is owned by the catalog."
      />

      {!picked ? (
        <Picker query={query} setQuery={setQuery} onPick={setPicked} />
      ) : (
        <OfferForm item={picked} onBack={() => setPicked(null)} />
      )}
    </AppShell>
  )
}

function Picker({
  query,
  setQuery,
  onPick,
}: {
  query: string
  setQuery: (v: string) => void
  onPick: (item: CatalogItem) => void
}) {
  const { data, isLoading, isError } = useCatalogSearch(query)
  const rows = data?.content ?? []

  return (
    <div className="space-y-4">
      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title or item number"
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : isError ? (
        <Card>
          <CardBody>
            <p className="text-sm text-red-700">
              Could not reach the catalog. Check that AT product-catalog is up and CATALOG_BASE_URL points at it.
            </p>
          </CardBody>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-sm text-muted-foreground">
              {query
                ? "No catalog matches. Ask the catalog team to add the item via AT admin → Catalog Items."
                : "Type to search the platform catalog."}
            </p>
          </CardBody>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {rows.map((item) => {
            const primary = item.images.find((i) => i.isPrimary) ?? item.images[0]
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onPick(item)}
                  className="w-full flex items-start gap-3 rounded-2xl border border-border bg-card p-3 text-left hover:border-brand-gold/40 hover:shadow-sm transition-all"
                >
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
                    {primary ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={primary.url} alt={primary.altText ?? ""} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground line-clamp-2">{item.title}</p>
                    <p className="mt-0.5 text-xs font-mono text-muted-foreground">{item.itemNumber}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.variants.length} variant{item.variants.length === 1 ? "" : "s"}
                      {item.brand ? ` • ${item.brand}` : null}
                    </p>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function OfferForm({ item, onBack }: { item: CatalogItem; onBack: () => void }) {
  const router = useRouter()
  const stock = useStock()
  const defaultLocation = stock.data?.[0]?.location_id ?? ""
  const [locationId, setLocationId] = useState(defaultLocation)
  if (!locationId && defaultLocation) setLocationId(defaultLocation)

  const [skuPrefix, setSkuPrefix] = useState("")
  const [variants, setVariants] = useState(
    item.variants.map((v) => ({
      catalogVariantId: v.id,
      sku: v.variantSku,
      name: v.name ?? "",
      enabled: true,
      cost: "",
      listPrice: "",
      compareAt: "",
      currency: "USD",
      initialStock: "0",
    })),
  )

  const primaryImage = useMemo(
    () => item.images.find((i) => i.isPrimary) ?? item.images[0],
    [item],
  )

  const create = useCreateOfferFromCatalog()

  function updateRow(i: number, patch: Partial<(typeof variants)[number]>) {
    setVariants((vs) => vs.map((v, idx) => (idx === i ? { ...v, ...patch } : v)))
  }

  async function submit() {
    const enabled = variants.filter((v) => v.enabled)
    if (enabled.length === 0) return
    const out = await create.mutateAsync({
      catalog_item_id: item.id,
      location_id: locationId,
      internal_sku_prefix: skuPrefix.trim() || undefined,
      variants: enabled.map((v) => ({
        catalog_variant_id: v.catalogVariantId,
        // Carry the (possibly edited) SKU through verbatim. When blank,
        // the backend falls back to the catalog's variantSku, which is
        // the original AfroTransact SKU — never an auto-generated suffix.
        internal_sku: v.sku.trim() || undefined,
        cost_cents: Math.round(parseFloat(v.cost || "0") * 100),
        list_price_cents: Math.round(parseFloat(v.listPrice || "0") * 100),
        compare_at_price_cents: v.compareAt
          ? Math.round(parseFloat(v.compareAt) * 100)
          : undefined,
        currency: v.currency || "USD",
        initial_stock: parseInt(v.initialStock || "0", 10),
      })),
    })
    router.push(`/products/${out.id}`)
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Back to search
      </button>

      <Card>
        <div className="flex items-start gap-4 p-5 border-b border-border">
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-muted">
            {primaryImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={primaryImage.url} alt={primaryImage.altText ?? ""} className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs text-muted-foreground">{item.itemNumber}</p>
            <h2 className="mt-0.5 text-lg font-bold text-foreground">{item.title}</h2>
            {item.brand ? <p className="mt-0.5 text-sm text-muted-foreground">{item.brand}</p> : null}
            {item.description ? (
              <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{item.description}</p>
            ) : null}
          </div>
        </div>

        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel htmlFor="loc">Stocking location</FieldLabel>
              <Input
                id="loc"
                required
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                placeholder="Location UUID"
                className="font-mono text-xs"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">Auto-filled from your first stock row.</p>
            </div>
            <div>
              <FieldLabel htmlFor="prefix">Internal SKU prefix</FieldLabel>
              <Input
                id="prefix"
                value={skuPrefix}
                onChange={(e) => setSkuPrefix(e.target.value)}
                placeholder={`e.g. ATX-INV-${item.itemNumber}`}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Optional. Empty &rarr; offer SKU = catalog item number{" "}
                <span className="font-mono">{item.itemNumber}</span>.
                Only set this if you need to disambiguate a multi-location offer.
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Variants</p>
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Stock</th>
                    <th className="px-3 py-2 text-left font-semibold">Variant</th>
                    <th className="px-3 py-2 text-right font-semibold">Cost</th>
                    <th className="px-3 py-2 text-right font-semibold">List price</th>
                    <th className="px-3 py-2 text-right font-semibold">Compare-at</th>
                    <th className="px-3 py-2 text-left font-semibold">Currency</th>
                    <th className="px-3 py-2 text-right font-semibold">Opening qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {variants.map((v, i) => (
                    <tr key={v.catalogVariantId}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={v.enabled}
                          onChange={(e) => updateRow(i, { enabled: e.target.checked })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={v.sku}
                          disabled={!v.enabled}
                          onChange={(e) => updateRow(i, { sku: e.target.value })}
                          className="h-9 w-40 rounded-lg border border-border bg-background px-2 text-left font-mono text-[11px] focus:border-brand-gold focus:outline-none focus:ring-2 focus:ring-brand-gold/30 disabled:opacity-50"
                          aria-label="Variant SKU"
                        />
                        {v.name ? <p className="mt-1 text-xs text-muted-foreground">{v.name}</p> : null}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          disabled={!v.enabled}
                          value={v.cost}
                          onChange={(e) => updateRow(i, { cost: e.target.value })}
                          className="h-9 w-24 rounded-lg border border-border bg-background px-2 text-right text-sm focus:border-brand-gold focus:outline-none focus:ring-2 focus:ring-brand-gold/30 disabled:opacity-50"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          disabled={!v.enabled}
                          value={v.listPrice}
                          onChange={(e) => updateRow(i, { listPrice: e.target.value })}
                          className="h-9 w-24 rounded-lg border border-border bg-background px-2 text-right text-sm focus:border-brand-gold focus:outline-none focus:ring-2 focus:ring-brand-gold/30 disabled:opacity-50"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          disabled={!v.enabled}
                          value={v.compareAt}
                          onChange={(e) => updateRow(i, { compareAt: e.target.value })}
                          className="h-9 w-24 rounded-lg border border-border bg-background px-2 text-right text-sm focus:border-brand-gold focus:outline-none focus:ring-2 focus:ring-brand-gold/30 disabled:opacity-50"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          disabled={!v.enabled}
                          value={v.currency}
                          onChange={(e) => updateRow(i, { currency: e.target.value })}
                          className="h-9 rounded-lg border border-border bg-background px-2 text-sm disabled:opacity-50"
                        >
                          <option>USD</option>
                          <option>EUR</option>
                          <option>GBP</option>
                          <option>NGN</option>
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min="0"
                          disabled={!v.enabled}
                          value={v.initialStock}
                          onChange={(e) => updateRow(i, { initialStock: e.target.value })}
                          className="h-9 w-20 rounded-lg border border-border bg-background px-2 text-right text-sm focus:border-brand-gold focus:outline-none focus:ring-2 focus:ring-brand-gold/30 disabled:opacity-50"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </CardBody>

        <div className="flex items-center justify-end gap-3 border-t border-border bg-muted/30 px-5 py-3">
          <button
            type="button"
            onClick={onBack}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <Button
            onClick={submit}
            loading={create.isPending}
            disabled={!variants.some((v) => v.enabled && v.listPrice) || !locationId}
          >
            Create offer
          </Button>
        </div>
      </Card>
    </div>
  )
}

// silence unused-import linter
void fromCents
void ((_: CatalogVariant) => null)
