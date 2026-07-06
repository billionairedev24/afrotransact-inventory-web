"use client"

import Link from "next/link"
import { use, useEffect, useState } from "react"
import { ChevronLeft, ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react"
import { AppShell, PageHeader } from "@/components/layout/AppShell"
import { Card, CardBody, CardHeader } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { FieldLabel, Input, Select, Textarea } from "@/components/ui/Input"
import {
  useCatalogAdminItem,
  useCatalogItemActions,
  type CatalogItemStatus,
} from "@/lib/queries"
import { relativeTime } from "@/lib/format"
import type { CatalogItemAdmin } from "@/lib/api"

const TONE: Record<CatalogItemStatus, "warning" | "success" | "danger"> = {
  draft: "warning",
  published: "success",
  suppressed: "danger",
}

export default function CatalogItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data, isLoading, isError } = useCatalogAdminItem(id)
  const actions = useCatalogItemActions(id)

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
        <p className="text-sm text-muted-foreground">Catalog item not found.</p>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <Link href="/catalog" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
        <ChevronLeft className="h-4 w-4" /> Catalog
      </Link>
      <PageHeader
        title={data.title}
        subtitle={`${data.itemNumber} • /${data.slug} • updated ${relativeTime(data.updatedAt)}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={TONE[data.status]}>{data.status}</Badge>
            {data.status === "draft" && (
              <Button loading={actions.publish.isPending} onClick={() => void actions.publish.mutateAsync()}>
                Publish
              </Button>
            )}
            {data.status === "published" && (
              <Button variant="danger" loading={actions.suppress.isPending} onClick={() => void actions.suppress.mutateAsync()}>
                Suppress
              </Button>
            )}
            {data.status === "suppressed" && (
              <Button variant="secondary" loading={actions.publish.isPending} onClick={() => void actions.publish.mutateAsync()}>
                Re-publish
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6">
        <div className="space-y-6">
          <ImagesCard item={data} actions={actions} />
          <BasicsCard item={data} actions={actions} />
          <VariantsCard item={data} actions={actions} />
        </div>
        <div className="space-y-6">
          <MetadataCard item={data} />
        </div>
      </div>
    </AppShell>
  )
}

type Actions = ReturnType<typeof useCatalogItemActions>

function ImagesCard({ item, actions }: { item: CatalogItemAdmin; actions: Actions }) {
  const [showForm, setShowForm] = useState(false)
  const [url, setUrl] = useState("")
  const [alt, setAlt] = useState("")

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
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
          </div>
          <div>
            <FieldLabel htmlFor="ialt">Alt text</FieldLabel>
            <Input id="ialt" value={alt} onChange={(e) => setAlt(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button size="sm" loading={actions.addImage.isPending}
              onClick={async () => {
                if (!url.trim()) return
                await actions.addImage.mutateAsync({ url: url.trim(), altText: alt.trim() || undefined })
                setUrl(""); setAlt(""); setShowForm(false)
              }}>
              Save
            </Button>
          </div>
        </div>
      )}
      <CardBody>
        {item.images.length === 0 ? (
          <p className="text-sm text-muted-foreground">No images yet. Add at least one before publishing.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {item.images.map((img) => (
              <div key={img.id} className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.altText ?? ""} className="h-full w-full object-cover" />
                {img.isPrimary && (
                  <span className="absolute left-2 top-2 inline-flex items-center rounded-full bg-brand-gold/90 px-2 py-0.5 text-[10px] font-bold text-brand-gold-foreground">
                    Primary
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => void actions.removeImage.mutateAsync(img.id)}
                  disabled={actions.removeImage.isPending}
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

function BasicsCard({ item, actions }: { item: CatalogItemAdmin; actions: Actions }) {
  const [title, setTitle] = useState(item.title)
  const [description, setDescription] = useState(item.description)
  const [brand, setBrand] = useState(item.brand ?? "")
  const [productType, setProductType] = useState(item.productType)
  const [tags, setTags] = useState<string[]>(item.tags)
  const [tagDraft, setTagDraft] = useState("")
  const [highlights, setHighlights] = useState<string[]>(parseHighlights(item.highlights))
  const [highlightDraft, setHighlightDraft] = useState("")

  useEffect(() => {
    setTitle(item.title); setDescription(item.description); setBrand(item.brand ?? "")
    setProductType(item.productType); setTags(item.tags); setHighlights(parseHighlights(item.highlights))
  }, [item])

  const dirty =
    title !== item.title || description !== (item.description ?? "") ||
    brand !== (item.brand ?? "") || productType !== item.productType ||
    JSON.stringify(tags) !== JSON.stringify(item.tags) ||
    JSON.stringify(highlights) !== JSON.stringify(parseHighlights(item.highlights))

  return (
    <Card>
      <CardHeader><h2 className="text-base font-semibold">Basics</h2></CardHeader>
      <CardBody className="space-y-4">
        <div>
          <FieldLabel htmlFor="t">Title</FieldLabel>
          <Input id="t" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel htmlFor="b">Brand</FieldLabel>
            <Input id="b" value={brand} onChange={(e) => setBrand(e.target.value)} />
          </div>
          <div>
            <FieldLabel htmlFor="pt">Product type</FieldLabel>
            <Select id="pt" value={productType} onChange={(e) => setProductType(e.target.value)}>
              <option value="physical">Physical</option>
              <option value="digital">Digital</option>
              <option value="service">Service</option>
            </Select>
          </div>
        </div>
        <div>
          <FieldLabel htmlFor="d">Description</FieldLabel>
          <Textarea id="d" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div>
          <FieldLabel htmlFor="tag">Tags</FieldLabel>
          <div className="flex gap-2 mb-2">
            <Input id="tag" value={tagDraft} onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  const t = tagDraft.trim()
                  if (t && !tags.includes(t)) { setTags([...tags, t]); setTagDraft("") }
                }
              }} />
            <Button type="button" variant="secondary" size="sm" onClick={() => {
              const t = tagDraft.trim()
              if (t && !tags.includes(t)) { setTags([...tags, t]); setTagDraft("") }
            }}><Plus className="h-3.5 w-3.5" /></Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full bg-brand-gold/20 px-2.5 py-0.5 text-xs font-medium">
                {t}
                <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))}><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="hl">Highlights</FieldLabel>
          <div className="flex gap-2 mb-2">
            <Input id="hl" value={highlightDraft} onChange={(e) => setHighlightDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  const t = highlightDraft.trim()
                  if (t) { setHighlights([...highlights, t]); setHighlightDraft("") }
                }
              }} placeholder="Add a bullet" />
            <Button type="button" variant="secondary" size="sm" onClick={() => {
              const t = highlightDraft.trim()
              if (t) { setHighlights([...highlights, t]); setHighlightDraft("") }
            }}><Plus className="h-3.5 w-3.5" /></Button>
          </div>
          <ul className="space-y-1.5">
            {highlights.map((h, i) => (
              <li key={i} className="flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2 text-sm">
                <span className="flex-1">{h}</span>
                <button type="button" onClick={() => setHighlights(highlights.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <Button type="button" disabled={!dirty} loading={actions.update.isPending}
            onClick={() => void actions.update.mutateAsync({
              title,
              description,
              brand: brand || undefined,
              productType,
              tags,
              highlights: JSON.stringify(highlights),
            })}>
            Save changes
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

function VariantsCard({ item, actions }: { item: CatalogItemAdmin; actions: Actions }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ variantSku: "", gtin: "", name: "", attributeValues: "{}" })

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Variants</h2>
        <Button size="sm" variant="secondary" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-3.5 w-3.5" /> {showForm ? "Close" : "Add variant"}
        </Button>
      </CardHeader>
      {showForm && (
        <div className="border-b border-border bg-muted/30 px-5 py-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <FieldLabel htmlFor="vsku">SKU</FieldLabel>
              <Input id="vsku" value={form.variantSku} onChange={(e) => setForm({ ...form, variantSku: e.target.value })} placeholder="auto-generated" className="font-mono text-xs" />
            </div>
            <div>
              <FieldLabel htmlFor="vgtin">GTIN / UPC</FieldLabel>
              <Input id="vgtin" value={form.gtin} onChange={(e) => setForm({ ...form, gtin: e.target.value })} className="font-mono text-xs" />
            </div>
            <div>
              <FieldLabel htmlFor="vname">Display name</FieldLabel>
              <Input id="vname" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <FieldLabel htmlFor="vattrs">Attributes (JSON)</FieldLabel>
              <Input id="vattrs" value={form.attributeValues} onChange={(e) => setForm({ ...form, attributeValues: e.target.value })} className="font-mono text-xs" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" loading={actions.addVariant.isPending}
              onClick={async () => {
                await actions.addVariant.mutateAsync({
                  variantSku: form.variantSku.trim() || undefined,
                  gtin: form.gtin.trim() || undefined,
                  name: form.name.trim() || undefined,
                  attributeValues: form.attributeValues.trim() || "{}",
                })
                setForm({ variantSku: "", gtin: "", name: "", attributeValues: "{}" })
                setShowForm(false)
              }}>
              Save variant
            </Button>
          </div>
        </div>
      )}
      {item.variants.length === 0 ? (
        <CardBody><p className="text-sm text-muted-foreground">No variants yet.</p></CardBody>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-5 py-3 text-left font-semibold">SKU</th>
              <th className="px-5 py-3 text-left font-semibold">Name</th>
              <th className="px-5 py-3 text-left font-semibold">GTIN</th>
              <th className="px-5 py-3 text-right font-semibold">Weight</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {item.variants.map((v) => (
              <tr key={v.id}>
                <td className="px-5 py-3 font-mono text-xs">{v.variantSku}</td>
                <td className="px-5 py-3 text-foreground">{v.name ?? "—"}</td>
                <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{v.gtin ?? "—"}</td>
                <td className="px-5 py-3 text-right tabular-nums">{v.weightKg ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}

function MetadataCard({ item }: { item: CatalogItemAdmin }) {
  return (
    <Card>
      <CardHeader><h2 className="text-base font-semibold">Integration</h2></CardHeader>
      <CardBody className="space-y-2.5 text-xs">
        <KV label="Item number" value={item.itemNumber} mono />
        <KV label="Slug" value={item.slug} mono />
        <KV label="Status" value={item.status} />
        <KV label="Created" value={new Date(item.createdAt).toLocaleString()} />
        <KV label="Updated" value={new Date(item.updatedAt).toLocaleString()} />
        {item.publishedAt && <KV label="Published" value={new Date(item.publishedAt).toLocaleString()} />}
        {item.suppressedAt && <KV label="Suppressed" value={new Date(item.suppressedAt).toLocaleString()} />}
        <KV label="Categories" value={item.categoryIds.length ? `${item.categoryIds.length} attached` : "—"} />
      </CardBody>
    </Card>
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

function parseHighlights(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}
