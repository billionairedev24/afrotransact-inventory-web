"use client"

import { useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  ChevronLeft, UploadCloud, FileText, Download, CheckCircle2, AlertTriangle, X,
} from "lucide-react"
import { AppShell, PageHeader } from "@/components/layout/AppShell"
import { Card, CardBody, CardHeader } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { FieldLabel, Select } from "@/components/ui/Input"
import { useCreateFullProduct, useLocations, useCategories, useMedia } from "@/lib/queries"

// One product (single variant) per row. Header-based so columns can be in any
// order; unknown columns are ignored. cost/price are in dollars, weight in lb,
// dimensions in inches, tags are semicolon-separated (commas are the delimiter).
//
// IMAGES BY NAME
// --------------
// The `images` column lets you attach product photos in bulk WITHOUT pasting
// long URLs. Steps for the operator:
//   1. Go to Media (or a product's Images card) and upload the photos first,
//      OR click "Sync from UploadThing" so the media library knows about them.
//   2. In the spreadsheet's `images` column, put the image's NAME exactly as it
//      appears in the media library — the file name, e.g. `rice-5kg.png`.
//      Multiple images? Separate them with semicolons: `rice-front.png;rice-back.png`.
//      The first name becomes the primary image (sort order 0).
// Matching is case-insensitive and also works with or without the file
// extension (`rice-5kg` matches `rice-5kg.png`). Names that don't match any
// uploaded media are flagged in the preview and simply skipped — the product is
// still created, just without that picture. Leave the column blank for none.
const COLUMNS = [
  "title", "sku", "cost", "price", "qty",
  "description", "brand", "category", "tags", "images", "variant_name",
  "weight_lb", "length_in", "width_in", "height_in",
] as const

const TEMPLATE = [
  "title,sku,cost,price,qty,description,brand,category,tags,images,variant_name,weight_lb,length_in,width_in,height_in",
  // images: names of already-uploaded media, semicolons for multiple, first = primary. Blank = no image.
  'Premium Nigerian Rice,RICE-5KG,12.00,19.99,100,"Long-grain parboiled rice, stone-free.",Mama Gold,Food & Grocery,rice;staple;party-size,rice-5kg-front.png;rice-5kg-back.png,5kg bag,11,16,11,5',
  "Jollof Spice Mix,SPICE-JLF,3.10,6.50,250,Ready-blend jollof seasoning.,AfroTaste,Food & Grocery,spice;jollof,jollof-spice.png,100g pouch,0.25,5,4,1",
  "Palm Oil 1L,OIL-PALM-1L,4.20,8.00,60,Pure red palm oil.,,Food & Grocery,oil;cooking,,1L bottle,2.4,4,4,10",
].join("\n")

const LBS_TO_KG = 0.45359237
const lbToKg = (lb: number | undefined) =>
  lb === undefined || Number.isNaN(lb) ? undefined : Math.round(lb * LBS_TO_KG * 1000) / 1000

type ParsedRow = {
  line: number
  title: string
  sku: string
  cost: number
  price: number
  qty: number
  description: string
  brand: string
  category: string
  tags: string[]
  imageNames: string[]
  variantName: string
  weightLb?: number
  lengthIn?: number
  widthIn?: number
  heightIn?: number
  error?: string
}
type ImportResult = { sku: string; title: string; ok: boolean; error?: string }

/** CSV line parser — handles quoted fields and escaped quotes. */
function parseLine(line: string): string[] {
  const out: string[] = []
  let cur = "", q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (q) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++ } else q = false }
      else cur += c
    } else if (c === '"') q = true
    else if (c === ",") { out.push(cur); cur = "" }
    else cur += c
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

const numOrUndef = (s: string) => {
  if (!s?.trim()) return undefined
  const n = parseFloat(s)
  return Number.isNaN(n) ? undefined : n
}

function parseCsv(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length === 0) return []
  const header = parseLine(lines[0]).map((c) => c.toLowerCase().replace(/\s+/g, "_"))
  const hasHeader = header.includes("title") && header.includes("sku")
  // Column index lookup: header-based if a header row is present, else fall
  // back to the canonical COLUMNS order.
  const idx = (name: (typeof COLUMNS)[number]) =>
    hasHeader ? header.indexOf(name) : COLUMNS.indexOf(name)
  const start = hasHeader ? 1 : 0
  const rows: ParsedRow[] = []
  for (let i = start; i < lines.length; i++) {
    const cols = parseLine(lines[i])
    const get = (name: (typeof COLUMNS)[number]) => {
      const j = idx(name)
      return j >= 0 ? (cols[j] ?? "") : ""
    }
    const title = get("title")
    const sku = get("sku")
    const price = parseFloat(get("price"))
    const cost = parseFloat(get("cost"))
    const qty = parseInt(get("qty"), 10)

    let error: string | undefined
    if (!title) error = "Missing title"
    else if (!sku) error = "Missing SKU"
    else if (Number.isNaN(price) || price < 0) error = `Invalid price "${get("price")}"`
    else if (!get("cost").trim() ? false : (Number.isNaN(cost) || cost < 0)) error = `Invalid cost "${get("cost")}"`

    rows.push({
      line: i + 1,
      title, sku,
      cost: Number.isNaN(cost) ? 0 : cost,
      price: Number.isNaN(price) ? 0 : price,
      qty: Number.isNaN(qty) ? 0 : qty,
      description: get("description"),
      brand: get("brand"),
      category: get("category"),
      tags: get("tags").split(";").map((t) => t.trim()).filter(Boolean),
      imageNames: get("images").split(";").map((s) => s.trim()).filter(Boolean),
      variantName: get("variant_name"),
      weightLb: numOrUndef(get("weight_lb")),
      lengthIn: numOrUndef(get("length_in")),
      widthIn: numOrUndef(get("width_in")),
      heightIn: numOrUndef(get("height_in")),
      error,
    })
  }
  return rows
}

export default function BulkProductsPage() {
  const create = useCreateFullProduct()
  const { data: locations } = useLocations()
  const { data: categories } = useCategories()
  const { data: media } = useMedia()
  const fileRef = useRef<HTMLInputElement>(null)

  const [csv, setCsv] = useState("")
  const [fileName, setFileName] = useState("")
  const [locationId, setLocationId] = useState("")
  const [dragging, setDragging] = useState(false)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(0)
  const [results, setResults] = useState<ImportResult[] | null>(null)

  const resolvedLocation = locationId || locations?.[0]?.id || ""
  const rows = useMemo(() => parseCsv(csv), [csv])
  const valid = rows.filter((r) => !r.error)
  const invalid = rows.filter((r) => r.error)

  // Resolve a category name (case-insensitive) to its platform id.
  const categoryId = (name: string): string | undefined =>
    name ? categories?.find((c) => c.name.toLowerCase() === name.toLowerCase())?.id : undefined
  const categoryUnmatched = (r: ParsedRow) => Boolean(r.category) && !categoryId(r.category)

  // Media library lookup: image name (and name-without-extension) → URL, so the
  // `images` column can reference photos by file name instead of a URL.
  // Case-insensitive; `rice-5kg` matches `rice-5kg.png`.
  const stripExt = (s: string) => s.replace(/\.[a-z0-9]+$/i, "")
  const mediaByName = useMemo(() => {
    const map = new Map<string, string>()
    for (const m of media ?? []) {
      const n = (m.name ?? "").trim().toLowerCase()
      if (!n) continue
      if (!map.has(n)) map.set(n, m.url)
      const noExt = stripExt(n)
      if (noExt && !map.has(noExt)) map.set(noExt, m.url)
    }
    return map
  }, [media])

  // Resolve a row's image names → matched URLs (first = primary) + unmatched names.
  const resolveImages = (names: string[]): { urls: string[]; unmatched: string[] } => {
    const urls: string[] = []
    const unmatched: string[] = []
    for (const raw of names) {
      const key = raw.trim().toLowerCase()
      const url = mediaByName.get(key) ?? mediaByName.get(stripExt(key))
      if (url) urls.push(url)
      else unmatched.push(raw)
    }
    return { urls, unmatched }
  }

  function ingest(file: File) {
    setFileName(file.name)
    setResults(null)
    const reader = new FileReader()
    reader.onload = () => setCsv(String(reader.result ?? ""))
    reader.readAsText(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) ingest(file)
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "inventory-bulk-template.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  function reset() {
    setCsv(""); setFileName(""); setResults(null); setDone(0)
    if (fileRef.current) fileRef.current.value = ""
  }

  async function run() {
    if (!resolvedLocation) return alert("No warehouse found. Create one before importing.")
    if (valid.length === 0) return
    setRunning(true); setResults(null); setDone(0)
    const out: ImportResult[] = []
    for (const row of valid) {
      try {
        const catId = categoryId(row.category)
        const imageUrls = resolveImages(row.imageNames).urls
        await create.mutateAsync({
          title: row.title,
          description: row.description || undefined,
          sku: row.sku,
          brand: row.brand || undefined,
          status: "active",
          categoryIds: catId ? [catId] : undefined,
          tags: row.tags,
          imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
          locationId: resolvedLocation,
          variants: [{
            sku: row.sku,
            name: row.variantName || undefined,
            costCents: Math.round(row.cost * 100),
            priceCents: Math.round(row.price * 100),
            initialStock: row.qty,
            weightKg: lbToKg(row.weightLb),
            lengthIn: row.lengthIn,
            widthIn: row.widthIn,
            heightIn: row.heightIn,
          }],
        })
        out.push({ sku: row.sku, title: row.title, ok: true })
      } catch (e) {
        out.push({ sku: row.sku, title: row.title, ok: false, error: (e as { detail?: string })?.detail ?? "failed" })
      }
      setDone(out.length)
      setResults([...out])
    }
    setRunning(false)
  }

  const createdCount = results?.filter((r) => r.ok).length ?? 0

  return (
    <AppShell>
      <div className="mb-4">
        <Link href="/products" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Back to products
        </Link>
      </div>
      <PageHeader
        title="Bulk upload products"
        subtitle="Upload a CSV to create many products at once. Each row becomes a live, priced, in-stock product."
        actions={
          <Button variant="secondary" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4" /> Download template
          </Button>
        }
      />

      <div className="max-w-5xl space-y-4">
        <Card>
          <CardBody className="space-y-4">
            <div className="max-w-xs">
              <FieldLabel htmlFor="loc">Warehouse</FieldLabel>
              <Select id="loc" value={resolvedLocation} onChange={(e) => setLocationId(e.target.value)}>
                {(locations ?? []).map((l) => (
                  <option key={l.id} value={l.id}>{l.display_name} ({l.code})</option>
                ))}
              </Select>
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-colors ${
                dragging ? "border-brand-gold bg-brand-gold/10" : "border-border hover:border-brand-gold/60 hover:bg-muted/40"
              }`}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-gold/20">
                <UploadCloud className="h-5 w-5 text-foreground" />
              </div>
              {fileName ? (
                <p className="text-sm font-semibold text-foreground inline-flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-muted-foreground" /> {fileName}
                </p>
              ) : (
                <p className="text-sm font-semibold text-foreground">Drop a CSV here, or click to browse</p>
              )}
              <p className="text-xs text-muted-foreground max-w-lg">
                Required: <span className="font-mono">title, sku, price, qty</span>. Optional:{" "}
                <span className="font-mono">cost, description, brand, category, tags, images, variant_name, weight_lb, length_in, width_in, height_in</span>.
                Download the template for the exact format.
              </p>
              <p className="text-xs text-muted-foreground max-w-lg">
                <span className="font-semibold text-foreground">Adding photos:</span> upload images to the media
                library first (or click <span className="font-medium">Sync from UploadThing</span>), then put each
                image&rsquo;s file name in the <span className="font-mono">images</span> column — e.g.{" "}
                <span className="font-mono">rice-front.png;rice-back.png</span> (semicolons for multiple, first is the
                primary). Matching ignores case and the file extension. Unmatched names are flagged below and skipped.
                {media ? <> {media.length} image{media.length === 1 ? "" : "s"} available in your media library.</> : null}
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && ingest(e.target.files[0])}
              />
            </div>
            {csv && (
              <button type="button" onClick={reset} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                <X className="h-3 w-3" /> Clear
              </button>
            )}
          </CardBody>
        </Card>

        {/* Preview */}
        {rows.length > 0 && !results && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <span>Preview</span>
                <span className="text-xs font-normal">
                  <span className="text-green-600 font-semibold">{valid.length} ready</span>
                  {invalid.length > 0 && <span className="text-red-600 font-semibold"> · {invalid.length} to fix</span>}
                </span>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              <div className="max-h-96 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/60 text-xs text-muted-foreground">
                    <tr className="text-left">
                      <th className="px-4 py-2 font-medium">Title</th>
                      <th className="px-4 py-2 font-medium">SKU</th>
                      <th className="px-4 py-2 font-medium text-right">Cost</th>
                      <th className="px-4 py-2 font-medium text-right">Price</th>
                      <th className="px-4 py-2 font-medium text-right">Qty</th>
                      <th className="px-4 py-2 font-medium">Category</th>
                      <th className="px-4 py-2 font-medium">Images</th>
                      <th className="px-4 py-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((r) => (
                      <tr key={r.line} className={r.error ? "bg-red-50/50" : ""}>
                        <td className="px-4 py-2 font-medium text-foreground">{r.title || <span className="text-muted-foreground italic">—</span>}</td>
                        <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{r.sku || "—"}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{r.cost ? `$${r.cost.toFixed(2)}` : "—"}</td>
                        <td className="px-4 py-2 text-right tabular-nums">${r.price.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{r.qty}</td>
                        <td className="px-4 py-2 text-xs">
                          {r.category
                            ? categoryUnmatched(r)
                              ? <span className="inline-flex items-center gap-1 text-amber-600" title="No matching platform category — product will be created without one"><AlertTriangle className="h-3 w-3" /> {r.category}</span>
                              : <span className="text-muted-foreground">{r.category}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-2 text-xs">
                          {r.imageNames.length === 0
                            ? <span className="text-muted-foreground">—</span>
                            : (() => {
                                const { urls, unmatched } = resolveImages(r.imageNames)
                                return (
                                  <span className="inline-flex items-center gap-2">
                                    {urls.length > 0 && <span className="text-green-600">{urls.length} matched</span>}
                                    {unmatched.length > 0 && (
                                      <span
                                        className="inline-flex items-center gap-1 text-amber-600"
                                        title={`No media named: ${unmatched.join(", ")} — these will be skipped`}
                                      >
                                        <AlertTriangle className="h-3 w-3" /> {unmatched.length} missing
                                      </span>
                                    )}
                                  </span>
                                )
                              })()}
                        </td>
                        <td className="px-4 py-2">
                          {r.error
                            ? <span className="inline-flex items-center gap-1 text-xs text-red-600"><AlertTriangle className="h-3.5 w-3.5" /> {r.error}</span>
                            : <CheckCircle2 className="h-4 w-4 text-green-600" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Import action + progress */}
        {rows.length > 0 && (
          <div className="flex items-center gap-3">
            <Button onClick={run} loading={running} disabled={valid.length === 0 || running}>
              {running ? `Importing ${done}/${valid.length}…` : `Import ${valid.length} product${valid.length === 1 ? "" : "s"}`}
            </Button>
            {invalid.length > 0 && !running && (
              <span className="text-xs text-muted-foreground">{invalid.length} row{invalid.length === 1 ? "" : "s"} with errors will be skipped.</span>
            )}
          </div>
        )}

        {running && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-brand-gold transition-all" style={{ width: `${valid.length ? (done / valid.length) * 100 : 0}%` }} />
          </div>
        )}

        {/* Results */}
        {results && (
          <Card>
            <CardHeader>
              <span className="inline-flex items-center gap-2">
                {createdCount === results.length
                  ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                  : <AlertTriangle className="h-4 w-4 text-amber-600" />}
                {createdCount}/{results.length} products created
              </span>
            </CardHeader>
            <CardBody className="space-y-1">
              {results.map((r) => (
                <div key={r.sku} className="flex items-center gap-2 text-sm">
                  <span className={r.ok ? "text-green-600" : "text-red-600"}>{r.ok ? "✓" : "✕"}</span>
                  <span className="font-medium text-foreground">{r.title}</span>
                  <span className="font-mono text-xs text-muted-foreground">{r.sku}</span>
                  {!r.ok && <span className="text-xs text-red-600">— {r.error}</span>}
                </div>
              ))}
              <div className="pt-3">
                <Link href="/products"><Button variant="secondary" size="sm">View products</Button></Link>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </AppShell>
  )
}
