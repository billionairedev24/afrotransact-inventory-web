"use client"

import Link from "next/link"
import Image from "next/image"
import { use, useState } from "react"
import { ChevronLeft, Loader2, Plus, Trash2, ImagePlus } from "lucide-react"
import { AppShell, PageHeader } from "@/components/layout/AppShell"
import { Card, CardBody, CardHeader } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { FieldLabel, Input } from "@/components/ui/Input"
import {
  useAddVariant,
  useProduct,
  useProductImageActions,
} from "@/lib/queries"
import { fromCents, relativeTime } from "@/lib/format"
import type { ProductStatus } from "@/lib/api"

const STATUS_TONE: Record<ProductStatus, "neutral" | "success" | "warning"> = {
  draft: "warning",
  active: "success",
  retired: "neutral",
}

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data, isLoading, isError } = useProduct(id)
  const [showVariantForm, setShowVariantForm] = useState(false)

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
        <p className="text-sm text-muted-foreground">Product not found.</p>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <Link
        href="/products"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3"
      >
        <ChevronLeft className="h-4 w-4" /> Products
      </Link>
      <PageHeader
        title={data.title}
        subtitle={`SKU ${data.sku} • slug ${data.slug} • updated ${relativeTime(data.updated_at)}`}
        actions={<Badge tone={STATUS_TONE[data.status]}>{data.status}</Badge>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6">
        <div className="space-y-6">
          <ImagesCard productId={id} images={data.images ?? []} />

          <Card>
            <CardHeader><h2 className="text-base font-semibold">Description</h2></CardHeader>
            <CardBody>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {data.description || "No description yet."}
              </p>
            </CardBody>
          </Card>

          {data.highlights.length > 0 && (
            <Card>
              <CardHeader><h2 className="text-base font-semibold">Highlights</h2></CardHeader>
              <CardBody>
                <ul className="list-disc pl-5 space-y-1 text-sm text-foreground">
                  {data.highlights.map((h, i) => <li key={i}>{h}</li>)}
                </ul>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Variants</h2>
              <Button size="sm" variant="secondary" onClick={() => setShowVariantForm((v) => !v)}>
                <Plus className="h-3.5 w-3.5" /> {showVariantForm ? "Close" : "Add variant"}
              </Button>
            </CardHeader>
            {showVariantForm && <NewVariantForm productId={id} onDone={() => setShowVariantForm(false)} />}
            {(!data.variants || data.variants.length === 0) ? (
              <CardBody><p className="text-sm text-muted-foreground">No variants yet.</p></CardBody>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 text-left font-semibold">SKU</th>
                    <th className="px-5 py-3 text-left font-semibold">Name</th>
                    <th className="px-5 py-3 text-right font-semibold">Cost</th>
                    <th className="px-5 py-3 text-right font-semibold">List</th>
                    <th className="px-5 py-3 text-right font-semibold">Compare-at</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.variants.map((v) => (
                    <tr key={v.id}>
                      <td className="px-5 py-3 font-mono text-xs">{v.sku}</td>
                      <td className="px-5 py-3 text-muted-foreground">{v.name ?? "—"}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{fromCents(v.cost_cents, v.currency)}</td>
                      <td className="px-5 py-3 text-right tabular-nums font-semibold">{fromCents(v.list_price_cents, v.currency)}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">
                        {v.compare_at_price_cents != null
                          ? fromCents(v.compare_at_price_cents, v.currency)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><h2 className="text-base font-semibold">Tags</h2></CardHeader>
            <CardBody>
              {data.tags.length === 0 ? (
                <p className="text-xs text-muted-foreground">No tags yet.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {data.tags.map((t) => (
                    <span key={t} className="inline-flex items-center rounded-full bg-brand-gold/20 px-2.5 py-0.5 text-[11px] font-medium">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader><h2 className="text-base font-semibold">Categories</h2></CardHeader>
            <CardBody>
              {data.category_ids.length === 0 ? (
                <p className="text-xs text-muted-foreground">No categories assigned.</p>
              ) : (
                <ul className="space-y-1">
                  {data.category_ids.map((c) => (
                    <li key={c} className="font-mono text-[11px] text-foreground truncate">{c}</li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader><h2 className="text-base font-semibold">Integration</h2></CardHeader>
            <CardBody className="space-y-2 text-xs">
              <KV label="Inventory ID" value={data.id} mono />
              <KV
                label="AT product ID"
                value={data.external_product_id ?? "—"}
                mono={!!data.external_product_id}
              />
              <KV label="Brand" value={data.brand ?? "—"} />
              <KV label="Created" value={relativeTime(data.created_at)} />
            </CardBody>
          </Card>
        </div>
      </div>
    </AppShell>
  )
}

function KV({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={`break-all text-right ${mono ? "font-mono text-[10px]" : ""}`}>{value}</span>
    </div>
  )
}

function ImagesCard({ productId, images }: { productId: string; images: import("@/lib/api").ProductImage[] }) {
  const actions = useProductImageActions(productId)
  const [showForm, setShowForm] = useState(false)
  const [url, setUrl] = useState("")
  const [alt, setAlt] = useState("")
  async function add() {
    if (!url.trim()) return
    await actions.add.mutateAsync({ url: url.trim(), alt_text: alt.trim() || undefined })
    setUrl("")
    setAlt("")
    setShowForm(false)
  }
  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Images</h2>
        <Button size="sm" variant="secondary" onClick={() => setShowForm((v) => !v)}>
          <ImagePlus className="h-3.5 w-3.5" /> {showForm ? "Close" : "Add image"}
        </Button>
      </CardHeader>
      {showForm && (
        <div className="border-b border-border bg-muted/30 px-5 py-4 space-y-3">
          <div>
            <FieldLabel htmlFor="iurl">URL</FieldLabel>
            <Input id="iurl" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/yam.jpg" />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Upload to your object store (ufs/S3), then paste the public URL here.
            </p>
          </div>
          <div>
            <FieldLabel htmlFor="ialt">Alt text</FieldLabel>
            <Input id="ialt" value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Whole peeled yam on a wooden table" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button size="sm" loading={actions.add.isPending} onClick={add}>Save image</Button>
          </div>
        </div>
      )}
      <CardBody>
        {images.length === 0 ? (
          <p className="text-sm text-muted-foreground">No images yet. Add at least one before activating the product.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {images.map((img) => (
              <div key={img.id} className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-muted">
                {/* Using <img> rather than next/image because we don't control the remote host list. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.alt_text ?? ""} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => void actions.remove.mutateAsync(img.id)}
                  disabled={actions.remove.isPending}
                  className="absolute top-2 right-2 rounded-lg bg-black/60 p-1.5 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Remove image"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  )
}

function NewVariantForm({ productId, onDone }: { productId: string; onDone: () => void }) {
  const add = useAddVariant(productId)
  const [form, setForm] = useState({ sku: "", name: "", upc: "", cost: "", price: "", compareAt: "", currency: "USD" })
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    await add.mutateAsync({
      sku: form.sku.trim(),
      name: form.name.trim() || undefined,
      upc: form.upc.trim() || undefined,
      cost_cents: Math.round(parseFloat(form.cost || "0") * 100),
      list_price_cents: Math.round(parseFloat(form.price || "0") * 100),
      compare_at_price_cents: form.compareAt ? Math.round(parseFloat(form.compareAt) * 100) : undefined,
      currency: form.currency,
    })
    setForm({ sku: "", name: "", upc: "", cost: "", price: "", compareAt: "", currency: "USD" })
    onDone()
  }
  return (
    <form onSubmit={submit} className="border-b border-border bg-muted/40 px-5 py-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <FieldLabel htmlFor="vsku">SKU</FieldLabel>
          <Input id="vsku" required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
        </div>
        <div>
          <FieldLabel htmlFor="vname">Display name</FieldLabel>
          <Input id="vname" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Large — Yellow" />
        </div>
        <div>
          <FieldLabel htmlFor="vupc">UPC</FieldLabel>
          <Input id="vupc" value={form.upc} onChange={(e) => setForm({ ...form, upc: e.target.value })} placeholder="(optional)" />
        </div>
        <div>
          <FieldLabel htmlFor="vcurrency">Currency</FieldLabel>
          <Input id="vcurrency" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
        </div>
        <div>
          <FieldLabel htmlFor="vcost">Cost</FieldLabel>
          <Input id="vcost" type="number" step="0.01" min="0" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
        </div>
        <div>
          <FieldLabel htmlFor="vprice">List price</FieldLabel>
          <Input id="vprice" type="number" step="0.01" min="0" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
        </div>
        <div>
          <FieldLabel htmlFor="vcompare">Compare-at</FieldLabel>
          <Input id="vcompare" type="number" step="0.01" min="0" value={form.compareAt} onChange={(e) => setForm({ ...form, compareAt: e.target.value })} placeholder="(optional)" />
        </div>
      </div>
      <Button type="submit" size="sm" loading={add.isPending}>Save variant</Button>
    </form>
  )
}
