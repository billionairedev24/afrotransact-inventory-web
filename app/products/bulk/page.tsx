"use client"

import { useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  ChevronLeft, UploadCloud, FileText, Download, CheckCircle2, AlertTriangle, X, Loader2,
} from "lucide-react"
import { AppShell, PageHeader } from "@/components/layout/AppShell"
import { Card, CardBody, CardHeader } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { FieldLabel, Select } from "@/components/ui/Input"
import { useCreateFullProduct, useLocations } from "@/lib/queries"

const TEMPLATE = `title,sku,price,qty
Premium Nigerian Rice,RICE-5KG,19.99,100
Jollof Spice Mix,SPICE-JLF,6.50,250
Palm Oil 1L,OIL-PALM-1L,8.00,60`

type ParsedRow = {
  line: number
  title: string
  sku: string
  price: number
  qty: number
  error?: string
}
type ImportResult = { sku: string; title: string; ok: boolean; error?: string }

/** Minimal CSV line parser — handles quoted fields and escaped quotes. */
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

function parseCsv(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length === 0) return []
  // Skip a header row if the first line looks like column names.
  const first = parseLine(lines[0]).map((c) => c.toLowerCase())
  const start = first.includes("title") && first.includes("sku") ? 1 : 0
  const rows: ParsedRow[] = []
  for (let i = start; i < lines.length; i++) {
    const cols = parseLine(lines[i])
    const line = i + 1
    const [title = "", sku = "", priceStr = "", qtyStr = ""] = cols
    const price = parseFloat(priceStr)
    const qty = parseInt(qtyStr, 10)
    let error: string | undefined
    if (cols.length < 4) error = 'Expected 4 columns: title, sku, price, qty'
    else if (!title) error = "Missing title"
    else if (!sku) error = "Missing SKU"
    else if (Number.isNaN(price) || price < 0) error = `Invalid price "${priceStr}"`
    rows.push({ line, title, sku, price: Number.isNaN(price) ? 0 : price, qty: Number.isNaN(qty) ? 0 : qty, error })
  }
  return rows
}

export default function BulkProductsPage() {
  const create = useCreateFullProduct()
  const { data: locations } = useLocations()
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
        await create.mutateAsync({
          title: row.title,
          sku: row.sku,
          status: "active",
          locationId: resolvedLocation,
          variants: [{ sku: row.sku, priceCents: Math.round(row.price * 100), initialStock: row.qty }],
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
        subtitle="Upload a CSV to create many products at once. Each row becomes a live product with stock."
        actions={
          <Button variant="secondary" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4" /> Download template
          </Button>
        }
      />

      <div className="max-w-4xl space-y-4">
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

            {/* Drop zone */}
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
              <p className="text-xs text-muted-foreground">
                Columns: <span className="font-mono">title, sku, price, qty</span> — one product per row
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
                      <th className="px-4 py-2 font-medium text-right">Price</th>
                      <th className="px-4 py-2 font-medium text-right">Qty</th>
                      <th className="px-4 py-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((r) => (
                      <tr key={r.line} className={r.error ? "bg-red-50/50" : ""}>
                        <td className="px-4 py-2 font-medium text-foreground">{r.title || <span className="text-muted-foreground italic">—</span>}</td>
                        <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{r.sku || "—"}</td>
                        <td className="px-4 py-2 text-right tabular-nums">${r.price.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{r.qty}</td>
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
