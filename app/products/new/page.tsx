"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ChevronLeft, X, Plus } from "lucide-react"
import { AppShell, PageHeader } from "@/components/layout/AppShell"
import { Card, CardBody, CardHeader } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { FieldLabel, Input, Select, Textarea } from "@/components/ui/Input"
import { useCreateProduct } from "@/lib/queries"
import type { ProductStatus } from "@/lib/api"
import { Slugify } from "@/lib/slug"

export default function NewProductPage() {
  const router = useRouter()
  const create = useCreateProduct()
  const [form, setForm] = useState({
    sku: "",
    slug: "",
    title: "",
    description: "",
    brand: "",
    status: "draft" as ProductStatus,
    metaTitle: "",
    metaDescription: "",
  })
  const [tags, setTags] = useState<string[]>([])
  const [tagDraft, setTagDraft] = useState("")
  const [highlights, setHighlights] = useState<string[]>([])
  const [highlightDraft, setHighlightDraft] = useState("")
  const [categoryIds, setCategoryIds] = useState<string[]>([])
  const [categoryDraft, setCategoryDraft] = useState("")

  // Auto-derive slug from SKU when the slug field is empty.
  function onSkuChange(v: string) {
    setForm((f) => ({
      ...f,
      sku: v,
      slug: f.slug === "" || f.slug === Slugify(f.sku) ? Slugify(v) : f.slug,
    }))
  }

  function addTag() {
    const t = tagDraft.trim()
    if (!t || tags.includes(t)) return
    setTags((xs) => [...xs, t])
    setTagDraft("")
  }
  function addHighlight() {
    const t = highlightDraft.trim()
    if (!t) return
    setHighlights((xs) => [...xs, t])
    setHighlightDraft("")
  }
  function addCategory() {
    const t = categoryDraft.trim()
    if (!t || categoryIds.includes(t)) return
    setCategoryIds((xs) => [...xs, t])
    setCategoryDraft("")
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const product = await create.mutateAsync({
      sku: form.sku.trim(),
      slug: form.slug.trim(),
      title: form.title.trim(),
      description: form.description.trim(),
      brand: form.brand.trim() || undefined,
      status: form.status,
      tags,
      highlights,
      category_ids: categoryIds,
      meta_title: form.metaTitle.trim() || undefined,
      meta_description: form.metaDescription.trim() || undefined,
    })
    router.push(`/products/${product.id}`)
  }

  return (
    <AppShell>
      <Link
        href="/products"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3"
      >
        <ChevronLeft className="h-4 w-4" /> Products
      </Link>
      <PageHeader title="New product" subtitle="Add a SKU to the house catalog." />

      <form onSubmit={submit} className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader><h2 className="text-base font-semibold">Basics</h2></CardHeader>
            <CardBody className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <FieldLabel htmlFor="sku">SKU</FieldLabel>
                  <Input id="sku" required value={form.sku} onChange={(e) => onSkuChange(e.target.value)} placeholder="AT-YAM-001" />
                </div>
                <div>
                  <FieldLabel htmlFor="slug">Slug</FieldLabel>
                  <Input id="slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="auto from SKU" />
                </div>
              </div>
              <div>
                <FieldLabel htmlFor="title">Title</FieldLabel>
                <Input id="title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Premium Nigerian Yam" />
              </div>
              <div>
                <FieldLabel htmlFor="brand">Brand</FieldLabel>
                <Input id="brand" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="(optional)" />
              </div>
              <div>
                <FieldLabel htmlFor="desc">Description</FieldLabel>
                <Textarea id="desc" rows={6} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What buyers will read on the listing page." />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader><h2 className="text-base font-semibold">Highlights</h2></CardHeader>
            <CardBody className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Selling-point bullets shown on the PDP. Add one at a time.
              </p>
              <div className="flex gap-2">
                <Input value={highlightDraft} onChange={(e) => setHighlightDraft(e.target.value)} placeholder="e.g. Grown in Abuja, harvested weekly" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addHighlight())} />
                <Button type="button" variant="secondary" size="sm" onClick={addHighlight}><Plus className="h-3.5 w-3.5" /></Button>
              </div>
              <ul className="space-y-1.5">
                {highlights.map((h, i) => (
                  <li key={i} className="flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2 text-sm">
                    <span className="flex-1">{h}</span>
                    <button type="button" onClick={() => setHighlights((xs) => xs.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader><h2 className="text-base font-semibold">Search & SEO</h2></CardHeader>
            <CardBody className="space-y-4">
              <div>
                <FieldLabel htmlFor="tag">Tags</FieldLabel>
                <div className="flex gap-2">
                  <Input id="tag" value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} placeholder="yam, food, abuja" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())} />
                  <Button type="button" variant="secondary" size="sm" onClick={addTag}><Plus className="h-3.5 w-3.5" /></Button>
                </div>
                {tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {tags.map((t) => (
                      <span key={t} className="inline-flex items-center gap-1 rounded-full bg-brand-gold/20 px-2.5 py-0.5 text-xs font-medium">
                        {t}
                        <button type="button" onClick={() => setTags((xs) => xs.filter((x) => x !== t))} className="hover:text-foreground">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <FieldLabel htmlFor="mtitle">Meta title</FieldLabel>
                <Input id="mtitle" value={form.metaTitle} onChange={(e) => setForm({ ...form, metaTitle: e.target.value })} placeholder="(falls back to title)" />
              </div>
              <div>
                <FieldLabel htmlFor="mdesc">Meta description</FieldLabel>
                <Textarea id="mdesc" rows={3} value={form.metaDescription} onChange={(e) => setForm({ ...form, metaDescription: e.target.value })} placeholder="(falls back to description)" />
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><h2 className="text-base font-semibold">Status</h2></CardHeader>
            <CardBody>
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ProductStatus })}>
                <option value="draft">Draft — not visible</option>
                <option value="active">Active — visible to buyers</option>
                <option value="retired">Retired</option>
              </Select>
            </CardBody>
          </Card>

          <Card>
            <CardHeader><h2 className="text-base font-semibold">Categories</h2></CardHeader>
            <CardBody className="space-y-2">
              <p className="text-xs text-muted-foreground">
                AfroTransact category UUIDs. Use the storefront admin to look these up.
              </p>
              <div className="flex gap-2">
                <Input value={categoryDraft} onChange={(e) => setCategoryDraft(e.target.value)} placeholder="UUID" className="font-mono text-xs" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCategory())} />
                <Button type="button" variant="secondary" size="sm" onClick={addCategory}><Plus className="h-3.5 w-3.5" /></Button>
              </div>
              <ul className="space-y-1">
                {categoryIds.map((c) => (
                  <li key={c} className="flex items-center gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5 text-[11px] font-mono">
                    <span className="flex-1 truncate">{c}</span>
                    <button type="button" onClick={() => setCategoryIds((xs) => xs.filter((x) => x !== c))} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <div className="flex items-center gap-3">
            <Button type="submit" loading={create.isPending}>Create product</Button>
            <Link href="/products"><Button type="button" variant="ghost">Cancel</Button></Link>
          </div>
        </div>
      </form>
    </AppShell>
  )
}
