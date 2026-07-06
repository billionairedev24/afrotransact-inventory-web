"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { ChevronLeft, Plus, X } from "lucide-react"
import { AppShell, PageHeader } from "@/components/layout/AppShell"
import { Card, CardBody, CardHeader } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { FieldLabel, Input, Select, Textarea } from "@/components/ui/Input"
import { useCreateCatalogItem } from "@/lib/queries"
import type { CreateCatalogItemVariantBody } from "@/lib/api"

interface DraftVariant {
  variantSku: string
  gtin: string
  name: string
  attributeValues: string
  weightKg: string
}

const EMPTY_VARIANT: DraftVariant = {
  variantSku: "", gtin: "", name: "", attributeValues: "{}", weightKg: "",
}

export default function NewCatalogItemPage() {
  const router = useRouter()
  const create = useCreateCatalogItem()
  const [form, setForm] = useState({
    title: "", description: "", brand: "", productType: "physical",
    metaTitle: "", metaDescription: "",
  })
  const [tags, setTags] = useState<string[]>([])
  const [tagDraft, setTagDraft] = useState("")
  const [highlights, setHighlights] = useState<string[]>([])
  const [highlightDraft, setHighlightDraft] = useState("")
  const [categoryIds, setCategoryIds] = useState<string[]>([])
  const [categoryDraft, setCategoryDraft] = useState("")
  const [variants, setVariants] = useState<DraftVariant[]>([{ ...EMPTY_VARIANT }])

  function addTag() {
    const t = tagDraft.trim()
    if (!t || tags.includes(t)) return
    setTags((xs) => [...xs, t]); setTagDraft("")
  }
  function addHighlight() {
    const t = highlightDraft.trim()
    if (!t) return
    setHighlights((xs) => [...xs, t]); setHighlightDraft("")
  }
  function addCategory() {
    const t = categoryDraft.trim()
    if (!t || categoryIds.includes(t)) return
    setCategoryIds((xs) => [...xs, t]); setCategoryDraft("")
  }
  function updateVariant(i: number, patch: Partial<DraftVariant>) {
    setVariants((vs) => vs.map((v, idx) => (idx === i ? { ...v, ...patch } : v)))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const variantPayload: CreateCatalogItemVariantBody[] = variants.map((v) => ({
      variantSku: v.variantSku.trim() || undefined,
      gtin: v.gtin.trim() || undefined,
      name: v.name.trim() || undefined,
      attributeValues: v.attributeValues.trim() || "{}",
      weightKg: v.weightKg ? parseFloat(v.weightKg) : undefined,
    }))
    if (variantPayload.length === 0) return
    const item = await create.mutateAsync({
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      brand: form.brand.trim() || undefined,
      productType: form.productType,
      tags,
      highlights: JSON.stringify(highlights),
      metaTitle: form.metaTitle.trim() || undefined,
      metaDescription: form.metaDescription.trim() || undefined,
      categoryIds,
      variants: variantPayload,
    })
    router.push(`/catalog/${item.id}`)
  }

  return (
    <AppShell>
      <Link href="/catalog" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
        <ChevronLeft className="h-4 w-4" /> Catalog
      </Link>
      <PageHeader title="New catalog item" subtitle="Item number + slug are system-generated. Starts in draft until you publish." />

      <form onSubmit={submit} className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader><h2 className="text-base font-semibold">Basics</h2></CardHeader>
            <CardBody className="space-y-4">
              <div>
                <FieldLabel htmlFor="title">Title</FieldLabel>
                <Input id="title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Premium Nigerian Yam" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <FieldLabel htmlFor="brand">Brand</FieldLabel>
                  <Input id="brand" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
                </div>
                <div>
                  <FieldLabel htmlFor="ptype">Product type</FieldLabel>
                  <Select id="ptype" value={form.productType} onChange={(e) => setForm({ ...form, productType: e.target.value })}>
                    <option value="physical">Physical</option>
                    <option value="digital">Digital</option>
                    <option value="service">Service</option>
                  </Select>
                </div>
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
              <p className="text-xs text-muted-foreground">Selling-point bullets shown on the PDP. Add one at a time.</p>
              <div className="flex gap-2">
                <Input value={highlightDraft} onChange={(e) => setHighlightDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addHighlight() } }}
                  placeholder="e.g. Grown in Abuja, harvested weekly" />
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
            <CardHeader><h2 className="text-base font-semibold">Variants</h2></CardHeader>
            <CardBody className="space-y-3">
              <p className="text-xs text-muted-foreground">At least one variant. Leave SKU blank for system-generated.</p>
              {variants.map((v, i) => (
                <div key={i} className="rounded-xl border border-border bg-muted/30 p-4 space-y-3 relative">
                  {variants.length > 1 && (
                    <button type="button" onClick={() => setVariants((vs) => vs.filter((_, idx) => idx !== i))} className="absolute top-2 right-2 text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <FieldLabel htmlFor={`v${i}sku`}>SKU</FieldLabel>
                      <Input id={`v${i}sku`} value={v.variantSku} onChange={(e) => updateVariant(i, { variantSku: e.target.value })} placeholder="auto-generated" className="font-mono text-xs" />
                    </div>
                    <div>
                      <FieldLabel htmlFor={`v${i}gtin`}>GTIN / UPC</FieldLabel>
                      <Input id={`v${i}gtin`} value={v.gtin} onChange={(e) => updateVariant(i, { gtin: e.target.value })} className="font-mono text-xs" />
                    </div>
                    <div>
                      <FieldLabel htmlFor={`v${i}name`}>Display name</FieldLabel>
                      <Input id={`v${i}name`} value={v.name} onChange={(e) => updateVariant(i, { name: e.target.value })} placeholder="Large — Yellow" />
                    </div>
                    <div>
                      <FieldLabel htmlFor={`v${i}weight`}>Weight (kg)</FieldLabel>
                      <Input id={`v${i}weight`} type="number" step="0.001" value={v.weightKg} onChange={(e) => updateVariant(i, { weightKg: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <FieldLabel htmlFor={`v${i}attrs`}>Attribute values (JSON)</FieldLabel>
                    <Input id={`v${i}attrs`} value={v.attributeValues} onChange={(e) => updateVariant(i, { attributeValues: e.target.value })} className="font-mono text-xs" placeholder='{"size":"L","color":"yellow"}' />
                  </div>
                </div>
              ))}
              <Button type="button" variant="secondary" size="sm" onClick={() => setVariants((vs) => [...vs, { ...EMPTY_VARIANT }])}>
                <Plus className="h-3.5 w-3.5" /> Add variant
              </Button>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><h2 className="text-base font-semibold">Tags</h2></CardHeader>
            <CardBody className="space-y-3">
              <div className="flex gap-2">
                <Input value={tagDraft} onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag() } }}
                  placeholder="yam, food" />
                <Button type="button" variant="secondary" size="sm" onClick={addTag}><Plus className="h-3.5 w-3.5" /></Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 rounded-full bg-brand-gold/20 px-2.5 py-0.5 text-xs font-medium">
                      {t}
                      <button type="button" onClick={() => setTags((xs) => xs.filter((x) => x !== t))}><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader><h2 className="text-base font-semibold">Categories</h2></CardHeader>
            <CardBody className="space-y-2">
              <p className="text-xs text-muted-foreground">AT category UUIDs. Picker UI coming.</p>
              <div className="flex gap-2">
                <Input value={categoryDraft} onChange={(e) => setCategoryDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategory() } }}
                  placeholder="UUID" className="font-mono text-xs" />
                <Button type="button" variant="secondary" size="sm" onClick={addCategory}><Plus className="h-3.5 w-3.5" /></Button>
              </div>
              <ul className="space-y-1">
                {categoryIds.map((c) => (
                  <li key={c} className="flex items-center gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5 text-[11px] font-mono">
                    <span className="flex-1 truncate">{c}</span>
                    <button type="button" onClick={() => setCategoryIds((xs) => xs.filter((x) => x !== c))}><X className="h-3 w-3" /></button>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader><h2 className="text-base font-semibold">SEO</h2></CardHeader>
            <CardBody className="space-y-4">
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

          <div className="flex items-center gap-3">
            <Button type="submit" loading={create.isPending}>Create item</Button>
            <Link href="/catalog"><Button type="button" variant="ghost">Cancel</Button></Link>
          </div>
        </div>
      </form>
    </AppShell>
  )
}
