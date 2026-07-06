/**
 * Tiny CSV exporter. Generates a UTF-8 BOM'd CSV file and triggers a
 * client-side download. No deps. Used by Reports tabs.
 */
export function downloadCSV<T>(
  filename: string,
  rows: T[],
  headers: { key: keyof T; label: string }[],
) {
  if (rows.length === 0) return
  const esc = (v: unknown): string => {
    if (v == null) return ""
    const s = String(v)
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }
  const head = headers.map((h) => esc(h.label)).join(",")
  const body = rows.map((r) => headers.map((h) => esc(r[h.key])).join(",")).join("\n")
  const blob = new Blob(["﻿", head, "\n", body], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
