"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ChevronLeft, X, Plus } from "lucide-react"
import { AppShell, PageHeader } from "@/components/layout/AppShell"
import { Card, CardBody, CardHeader } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { FieldLabel, Input, Select, Textarea } from "@/components/ui/Input"
import { useCreateFullProduct, useLocations, useCategories, type NewVariantInput } from "@/lib/queries"
import type { ProductStatus } from "@/lib/api"
import { useUploadThing } from "@/lib/uploadthing"

const MAX_IMAGES = 3

type VariantRow = {
  name: string; sku: string; price: string; qty: string
  weight: string; length: string; width: string; height: string
}

const emptyVariant = (): VariantRow => ({
  name: "", sku: "", price: "", qty: "", weight: "", length: "", width: "", height: "",
})

const num = (s: string): number | undefined => {
  const n = parseFloat(s)
  return Number.isNaN(n) ? undefined : n
}

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
  const [imgDraft, setImgDraft] = useState("")
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [variants, setVariants] = useState<VariantRow[]>([emptyVariant()])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Image upload — same manual pattern the AfroTransact storefront uses
  // (useUploadThing + startUpload + a plain file input). Reliable across
  // browsers; no <UploadDropzone> component involved.
  const { startUpload, isUploading } = useUploadThing("productImage", {
    onClientUploadComplete: (res) => {
      const urls = (res ?? [])
        .map((f) => {
          const r = f as unknown as { ufsUrl?: string; url?: string; key?: string }
          return r.ufsUrl || r.url || (r.key ? `https://utfs.io/f/${r.key}` : "")
        })
        .filter(Boolean)
      setImageUrls((xs) => [...xs, ...urls].slice(0, MAX_IMAGES))
      setUploadError(null)
    },
    onUploadError: (err) => setUploadError(err.message || "Upload failed"),
  })

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = "" // allow re-selecting the same file
    if (picked.length === 0) return
    const room = MAX_IMAGES - imageUrls.length
    if (room <= 0) return
    const images = picked.filter((f) => f.type.startsWith("image/")).slice(0, room)
    if (images.length === 0) { setUploadError("Please choose image files."); return }
    setUploadError(null)
    await startUpload(images)
  }

  // Default the location to the first warehouse once loaded.
  const resolvedLocation = locationId || locations?.[0]?.id || ""

  function setVariant(i: number, patch: Partial<VariantRow>) {
    setVariants((vs) => vs.map((v, idx) => (idx === i ? { ...v, ...patch } : v)))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!resolvedLocation) {
      alert("No warehouse location found. Create one before adding stock.")
      return
    }
    const parsed: NewVariantInput[] = variants
      .filter((v) => v.sku.trim())
      .map((v) => ({
        sku: v.sku.trim(),
        name: v.name.trim() || undefined,
        priceCents: Math.round(parseFloat(v.price || "0") * 100),
        initialStock: parseInt(v.qty || "0", 10) || 0,
        weightKg: num(v.weight),
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
      <div className="mb-4">
        <Link href="/products" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Back to products
        </Link>
      </div>
      <PageHeader title="New product" subtitle="Create a product, its variants, and stock — it goes live on the storefront automatically." />

      <form onSubmit={submit} className="max-w-3xl space-y-4">
        <Card>
          <CardHeader>Product</CardHeader>
          <CardBody className="space-y-4">
            <div>
              <FieldLabel htmlFor="title">Title</FieldLabel>
              <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Premium Nigerian Rice" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel htmlFor="sku">Product SKU</FieldLabel>
                <Input id="sku" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="RICE-PREMIUM (defaults to 1st variant)" />
              </div>
              <div>
                <FieldLabel htmlFor="brand">Brand</FieldLabel>
                <Input id="brand" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="(optional)" />
              </div>
            </div>
            <div>
              <FieldLabel htmlFor="desc">Description</FieldLabel>
              <Textarea id="desc" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What buyers read on the listing page." />
            </div>
            <div className="grid grid-cols-2 gap-4">
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
            <div>
              <FieldLabel htmlFor="cat">Category</FieldLabel>
              <Select id="cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">— none —</option>
                {(categories ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                Pulled from the AfroTransact platform taxonomy. Need a new one? An admin adds it in the admin portal.
              </p>
            </div>
          </CardBody>
        </Card>

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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

        <Card>
          <CardHeader>Images <span className="font-normal text-muted-foreground">(up to {MAX_IMAGES})</span></CardHeader>
          <CardBody className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFiles}
            />
            {imageUrls.length < MAX_IMAGES ? (
              <button
                type="button"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border px-4 py-8 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:opacity-60"
              >
                {isUploading ? (
                  <span>Uploading…</span>
                ) : (
                  <>
                    <Plus className="h-5 w-5" />
                    <span>Click to upload images</span>
                    <span className="text-xs">PNG, JPG or WebP · up to {MAX_IMAGES} · {MAX_IMAGES - imageUrls.length} left</span>
                  </>
                )}
              </button>
            ) : (
              <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                Maximum of {MAX_IMAGES} images reached. Remove one to add another.
              </p>
            )}
            {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
            <div className="flex gap-2">
              <Input
                value={imgDraft}
                onChange={(e) => setImgDraft(e.target.value)}
                placeholder="…or paste an image URL"
                disabled={imageUrls.length >= MAX_IMAGES}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    const u = imgDraft.trim()
                    if (u) { setImageUrls((xs) => (xs.length >= MAX_IMAGES ? xs : [...xs, u])); setImgDraft("") }
                  }
                }}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={imageUrls.length >= MAX_IMAGES}
                onClick={() => { const u = imgDraft.trim(); if (u) { setImageUrls((xs) => (xs.length >= MAX_IMAGES ? xs : [...xs, u])); setImgDraft("") } }}
              >
                Add URL
              </Button>
            </div>
            {imageUrls.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {imageUrls.map((u, i) => (
                  <div key={i} className="relative h-20 w-20 overflow-hidden rounded-lg border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setImageUrls((xs) => xs.filter((_, idx) => idx !== i))}
                      className="absolute right-0.5 top-0.5 rounded bg-black/60 p-0.5 text-white"
                      aria-label="Remove image"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <span>Variants &amp; stock</span>
              <Button type="button" variant="secondary" size="sm" onClick={() => setVariants((vs) => [...vs, emptyVariant()])}>
                <Plus className="h-3.5 w-3.5" /> Add variant
              </Button>
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            {variants.map((v, i) => (
              <div key={i} className="rounded-xl border border-border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Variant {i + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={variants.length === 1}
                    onClick={() => setVariants((vs) => vs.filter((_, idx) => idx !== i))}
                    aria-label="Remove variant"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <FieldLabel htmlFor={`vn${i}`}>Name</FieldLabel>
                    <Input id={`vn${i}`} value={v.name} onChange={(e) => setVariant(i, { name: e.target.value })} placeholder="5kg bag" />
                  </div>
                  <div>
                    <FieldLabel htmlFor={`vs${i}`}>SKU</FieldLabel>
                    <Input id={`vs${i}`} value={v.sku} onChange={(e) => setVariant(i, { sku: e.target.value })} placeholder="RICE-5KG" className="font-mono text-xs" />
                  </div>
                  <div>
                    <FieldLabel htmlFor={`vp${i}`}>Price ($)</FieldLabel>
                    <Input id={`vp${i}`} type="number" min="0" step="0.01" value={v.price} onChange={(e) => setVariant(i, { price: e.target.value })} placeholder="19.99" />
                  </div>
                  <div>
                    <FieldLabel htmlFor={`vq${i}`}>Qty in stock</FieldLabel>
                    <Input id={`vq${i}`} type="number" min="0" step="1" value={v.qty} onChange={(e) => setVariant(i, { qty: e.target.value })} placeholder="100" />
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Packaging — used for shipping rates</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <FieldLabel htmlFor={`vw${i}`}>Weight (kg)</FieldLabel>
                      <Input id={`vw${i}`} type="number" min="0" step="0.001" value={v.weight} onChange={(e) => setVariant(i, { weight: e.target.value })} placeholder="18.14" />
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
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Each variant is one buyable option (size/weight) with its own SKU, price, and quantity.
              Quantity is received into the selected warehouse.
            </p>
          </CardBody>
        </Card>

        <div className="flex items-center gap-2">
          <Button type="submit" loading={create.isPending}>Create product</Button>
          <Link href="/products"><Button type="button" variant="ghost">Cancel</Button></Link>
        </div>
      </form>
    </AppShell>
  )
}
