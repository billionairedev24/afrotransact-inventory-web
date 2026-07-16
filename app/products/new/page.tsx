"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ChevronLeft, X, Plus, Copy } from "lucide-react"
import { AppShell } from "@/components/layout/AppShell"
import { Card, CardBody, CardHeader } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { FieldLabel, Input, Select, Textarea } from "@/components/ui/Input"
import { useCreateFullProduct, useLocations, useCategories, type NewVariantInput } from "@/lib/queries"
import type { ProductStatus } from "@/lib/api"
import { MediaPicker } from "@/components/media/MediaPicker"

const MAX_IMAGES = 6

type VariantRow = {
  name: string; sku: string; cost: string; price: string; qty: string
  weight: string; length: string; width: string; height: string
}

const emptyVariant = (): VariantRow => ({
  name: "", sku: "", cost: "", price: "", qty: "", weight: "", length: "", width: "", height: "",
})

const num = (s: string): number | undefined => {
  const n = parseFloat(s)
  return Number.isNaN(n) ? undefined : n
}

const LBS_TO_KG = 0.45359237
// The form takes weight in pounds (operator-friendly); the backend stores kg.
const lbToKg = (lb: number | undefined): number | undefined =>
  lb === undefined ? undefined : Math.round((lb * LBS_TO_KG) * 1000) / 1000

const money = (cents: number) =>
  `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * Create a fully sellable AfroTransact product in one submit: the product, its
 * priced variant(s), and initial stock. No separate catalog/offer step — the
 * inventory events materialize it onto the storefront automatically.
 */
export default function NewProductPage() {
  const router = useRouter()
  const create = useCreateFullProduct()
  const { data: locations } = useLocations()
  const { data: categories } = useCategories()

  const [title, setTitle] = useState("")
  const [sku, setSku] = useState("")
  const [description, setDescription] = useState("")
  const [brand, setBrand] = useState("")
  const [status, setStatus] = useState<ProductStatus>("active")
  const [locationId, setLocationId] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [tags, setTags] = useState("")
  const [highlights, setHighlights] = useState("")
  const [metaTitle, setMetaTitle] = useState("")
  const [metaDescription, setMetaDescription] = useState("")
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [variants, setVariants] = useState<VariantRow[]>([emptyVariant()])

  const resolvedLocation = locationId || locations?.[0]?.id || ""

  function setVariant(i: number, patch: Partial<VariantRow>) {
    setVariants((vs) => vs.map((v, idx) => (idx === i ? { ...v, ...patch } : v)))
  }
  function addVariant() {
    setVariants((vs) => [...vs, emptyVariant()])
  }
  function duplicateVariant(i: number) {
    // Copy pricing + packaging (the tedious parts); clear the SKU so it stays unique.
    setVariants((vs) => {
      const copy = { ...vs[i], sku: "" }
      return [...vs.slice(0, i + 1), copy, ...vs.slice(i + 1)]
    })
  }

  // ── Live summary ──────────────────────────────────────────────────────────
  const filled = variants.filter((v) => v.sku.trim())
  const prices = filled.map((v) => Math.round((parseFloat(v.price) || 0) * 100)).filter((c) => c > 0)
  const priceLabel =
    prices.length === 0 ? "—"
    : Math.min(...prices) === Math.max(...prices) ? money(prices[0])
    : `${money(Math.min(...prices))} – ${money(Math.max(...prices))}`
  const totalStock = filled.reduce((n, v) => n + (parseInt(v.qty || "0", 10) || 0), 0)
  const categoryName = categories?.find((c) => c.id === categoryId)?.name

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!resolvedLocation) {
      alert("No warehouse location found. Create one before adding stock.")
      return
    }
    // Required-field hardening: a product must have a category, and every
    // variant must have a price > 0 and a stock quantity (>= 0). These were
    // previously optional, which let category-less / price-less products in.
    if (!categoryId) {
      alert("Select a category before saving.")
      return
    }
    const filledVariants = variants.filter((v) => v.sku.trim())
    for (const v of filledVariants) {
      const label = v.sku.trim()
      if (!(parseFloat(v.price) > 0)) {
        alert(`Variant "${label}" needs a price greater than 0.`)
        return
      }
      const qtyRaw = v.qty.trim()
      const qtyNum = parseInt(qtyRaw, 10)
      if (qtyRaw === "" || Number.isNaN(qtyNum) || qtyNum < 0) {
        alert(`Variant "${label}" needs a stock quantity (0 or more).`)
        return
      }
    }
    const parsed: NewVariantInput[] = variants
      .filter((v) => v.sku.trim())
      .map((v) => ({
        sku: v.sku.trim(),
        name: v.name.trim() || undefined,
        priceCents: Math.round(parseFloat(v.price || "0") * 100),
        costCents: Math.round(parseFloat(v.cost || "0") * 100),
        initialStock: parseInt(v.qty || "0", 10) || 0,
        weightKg: lbToKg(num(v.weight)),
        lengthIn: num(v.length),
        widthIn: num(v.width),
        heightIn: num(v.height),
      }))
    if (parsed.length === 0) {
      alert("Add at least one variant with a SKU.")
      return
    }
    create.mutate(
      {
        title: title.trim(),
        description: description.trim() || undefined,
        sku: sku.trim() || parsed[0].sku,
        brand: brand.trim() || undefined,
        status,
        categoryIds: categoryId ? [categoryId] : undefined,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        highlights: highlights.split("\n").map((h) => h.trim()).filter(Boolean),
        metaTitle: metaTitle.trim() || undefined,
        metaDescription: metaDescription.trim() || undefined,
        imageUrls,
        locationId: resolvedLocation,
        variants: parsed,
      },
      { onSuccess: () => router.push("/products") },
    )
  }

  return (
    <AppShell>
      <div className="mb-5">
        <Link href="/products" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Back to products
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">New product</h1>
        <p className="text-sm text-muted-foreground">
          One form creates the product, its variants, and opening stock — it goes live on the storefront automatically.
        </p>
      </div>

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ── Main column ─────────────────────────────────────────────────── */}
        <div className="min-w-0 space-y-5">
          {/* Details */}
          <Card>
            <CardHeader>Details</CardHeader>
            <CardBody className="space-y-4">
              <div>
                <FieldLabel htmlFor="title">Title</FieldLabel>
                <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Premium Nigerian Rice" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel htmlFor="sku">Product SKU</FieldLabel>
                  <Input id="sku" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Defaults to 1st variant" className="font-mono text-xs" />
                </div>
                <div>
                  <FieldLabel htmlFor="brand">Brand</FieldLabel>
                  <Input id="brand" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="(optional)" />
                </div>
              </div>
              <div>
                <FieldLabel htmlFor="desc">Description</FieldLabel>
                <Textarea id="desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What buyers read on the listing page." />
              </div>
              <div>
                <FieldLabel htmlFor="cat">Category</FieldLabel>
                <Select id="cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">— none —</option>
                  {(categories ?? []).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  From the AfroTransact platform taxonomy. Need a new one? An admin adds it in the admin portal.
                </p>
              </div>
            </CardBody>
          </Card>

          {/* Variants — the heart of the form */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <span>Variants &amp; stock</span>
                  <p className="mt-0.5 text-xs font-normal text-muted-foreground">
                    Each variant is one buyable option (size/weight) with its own SKU, price, and quantity.
                  </p>
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={addVariant}>
                  <Plus className="h-3.5 w-3.5" /> Add
                </Button>
              </div>
            </CardHeader>
            <CardBody className="space-y-3">
              {variants.map((v, i) => (
                <div key={i} className="relative overflow-hidden rounded-xl border border-border bg-card">
                  <span className="absolute inset-y-0 left-0 w-1 bg-primary" aria-hidden />
                  <div className="space-y-3 p-4 pl-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Variant {i + 1}
                        {v.name.trim() && <span className="ml-2 normal-case text-foreground">· {v.name.trim()}</span>}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => duplicateVariant(i)}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label="Duplicate variant"
                          title="Duplicate (copies pricing + packaging)"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          disabled={variants.length === 1}
                          onClick={() => setVariants((vs) => vs.filter((_, idx) => idx !== i))}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
                          aria-label="Remove variant"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                      <div>
                        <FieldLabel htmlFor={`vn${i}`}>Name</FieldLabel>
                        <Input id={`vn${i}`} value={v.name} onChange={(e) => setVariant(i, { name: e.target.value })} placeholder="5kg bag" />
                      </div>
                      <div>
                        <FieldLabel htmlFor={`vs${i}`}>SKU</FieldLabel>
                        <Input id={`vs${i}`} value={v.sku} onChange={(e) => setVariant(i, { sku: e.target.value })} placeholder="RICE-5KG" className="font-mono text-xs" />
                      </div>
                      <div>
                        <FieldLabel htmlFor={`vc${i}`}>Unit cost ($)</FieldLabel>
                        <Input id={`vc${i}`} type="number" min="0" step="0.01" value={v.cost} onChange={(e) => setVariant(i, { cost: e.target.value })} placeholder="What you paid" title="What AfroTransact paid per unit — drives COGS + margin. Internal only." />
                      </div>
                      <div>
                        <FieldLabel htmlFor={`vp${i}`}>Sell price ($)</FieldLabel>
                        <Input id={`vp${i}`} type="number" min="0" step="0.01" value={v.price} onChange={(e) => setVariant(i, { price: e.target.value })} placeholder="19.99" title="What the buyer pays." />
                      </div>
                      <div>
                        <FieldLabel htmlFor={`vq${i}`}>Qty in stock</FieldLabel>
                        <Input id={`vq${i}`} type="number" min="0" step="1" value={v.qty} onChange={(e) => setVariant(i, { qty: e.target.value })} placeholder="100" />
                      </div>
                    </div>
                    <details className="group">
                      <summary className="cursor-pointer list-none text-xs font-medium text-muted-foreground hover:text-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Plus className="h-3 w-3 transition-transform group-open:rotate-45" />
                          Packaging &amp; shipping dimensions
                        </span>
                      </summary>
                      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div>
                          <FieldLabel htmlFor={`vw${i}`}>Weight (lb)</FieldLabel>
                          <Input id={`vw${i}`} type="number" min="0" step="0.01" value={v.weight} onChange={(e) => setVariant(i, { weight: e.target.value })} placeholder="40" />
                        </div>
                        <div>
                          <FieldLabel htmlFor={`vl${i}`}>Length (in)</FieldLabel>
                          <Input id={`vl${i}`} type="number" min="0" step="0.1" value={v.length} onChange={(e) => setVariant(i, { length: e.target.value })} placeholder="12" />
                        </div>
                        <div>
                          <FieldLabel htmlFor={`vwd${i}`}>Width (in)</FieldLabel>
                          <Input id={`vwd${i}`} type="number" min="0" step="0.1" value={v.width} onChange={(e) => setVariant(i, { width: e.target.value })} placeholder="9" />
                        </div>
                        <div>
                          <FieldLabel htmlFor={`vh${i}`}>Height (in)</FieldLabel>
                          <Input id={`vh${i}`} type="number" min="0" step="0.1" value={v.height} onChange={(e) => setVariant(i, { height: e.target.value })} placeholder="6" />
                        </div>
                      </div>
                    </details>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>

          {/* Media */}
          <Card>
            <CardHeader>Images <span className="font-normal text-muted-foreground">(up to {MAX_IMAGES})</span></CardHeader>
            <CardBody>
              <p className="mb-3 text-xs text-muted-foreground">
                Pick from your media library or upload new — images are named and reusable across products.
              </p>
              <MediaPicker value={imageUrls} onChange={setImageUrls} max={MAX_IMAGES} />
            </CardBody>
          </Card>

          {/* Discovery & SEO */}
          <Card>
            <CardHeader>Discovery &amp; SEO <span className="font-normal text-muted-foreground">(optional)</span></CardHeader>
            <CardBody className="space-y-4">
              <div>
                <FieldLabel htmlFor="tags">Tags</FieldLabel>
                <Input id="tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="rice, jollof, staple, party-size" />
                <p className="mt-1 text-xs text-muted-foreground">Comma-separated. Helps buyers find this in search.</p>
              </div>
              <div>
                <FieldLabel htmlFor="highlights">Highlights</FieldLabel>
                <Textarea id="highlights" rows={3} value={highlights} onChange={(e) => setHighlights(e.target.value)} placeholder={"One selling point per line\nStone-free, long grain\nImported from Abakaliki"} />
                <p className="mt-1 text-xs text-muted-foreground">One bullet per line — shown on the product page.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel htmlFor="metaTitle">Meta title</FieldLabel>
                  <Input id="metaTitle" value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} placeholder="SEO title override" />
                </div>
                <div>
                  <FieldLabel htmlFor="metaDesc">Meta description</FieldLabel>
                  <Input id="metaDesc" value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} placeholder="SEO description override" />
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* ── Sticky summary + actions ────────────────────────────────────── */}
        <aside className="h-fit space-y-3 lg:sticky lg:top-6">
          <Card>
            <CardBody className="space-y-4">
              <div>
                <p className="truncate text-sm font-semibold text-foreground">
                  {title.trim() || "Untitled product"}
                </p>
                <div className="mt-1.5">
                  <Badge tone={status === "active" ? "gold" : "neutral"}>
                    {status === "active" ? "Active — visible to buyers" : "Draft — hidden"}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2 border-t border-border pt-3 text-sm">
                <Row label="Variants" value={`${filled.length || 0}`} />
                <Row label="Price" value={priceLabel} />
                <Row label="Total stock" value={`${totalStock} unit${totalStock === 1 ? "" : "s"}`} />
                <Row label="Images" value={`${imageUrls.length}`} />
                <Row label="Category" value={categoryName ?? "—"} />
              </div>

              <div className="space-y-2 border-t border-border pt-3">
                <div>
                  <FieldLabel htmlFor="status">Status</FieldLabel>
                  <Select id="status" value={status} onChange={(e) => setStatus(e.target.value as ProductStatus)}>
                    <option value="active">Active — visible to buyers</option>
                    <option value="draft">Draft — not visible</option>
                  </Select>
                </div>
                <div>
                  <FieldLabel htmlFor="loc">Warehouse</FieldLabel>
                  <Select id="loc" value={resolvedLocation} onChange={(e) => setLocationId(e.target.value)}>
                    {(locations ?? []).map((l) => (
                      <option key={l.id} value={l.id}>{l.display_name} ({l.code})</option>
                    ))}
                  </Select>
                </div>
              </div>
            </CardBody>
          </Card>

          <Button type="submit" loading={create.isPending} className="w-full">Create product</Button>
          <Link href="/products" className="block">
            <Button type="button" variant="ghost" className="w-full">Cancel</Button>
          </Link>
        </aside>
      </form>
    </AppShell>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-medium text-foreground">{value}</span>
    </div>
  )
}
