"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, ScanLine, X } from "lucide-react"
import { Input } from "./Input"
import { api, type VariantLookup } from "@/lib/api"
import { useScannerTarget } from "@/hooks/useScannerFocus"

/**
 * ScannerInput — keyboard-wedge style scanner field. USB barcode scanners
 * emit characters then Enter; this component listens for Enter, hits the
 * /variants/lookup endpoint, calls onResolved with the variant, and clears
 * itself so the operator can scan the next item without touching anything.
 *
 * Works equally well for manual SKU entry: type, press Enter, same result.
 * The autoFocus + onBlur self-refocus keep the field hot during a scan
 * burst so scanners don't lose keystrokes between rows.
 */
export function ScannerInput({
  onResolved,
  placeholder = "Scan or type SKU / barcode…",
  autoFocus = true,
}: {
  onResolved: (v: VariantLookup) => void
  placeholder?: string
  autoFocus?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastHit, setLastHit] = useState<VariantLookup | null>(null)

  // Register this input as the page's active scanner target so the global
  // "/" hotkey (installed in AppShell) lands here.
  useScannerTarget(inputRef)

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  async function submit(code: string) {
    const trimmed = code.trim()
    if (!trimmed) return
    setBusy(true)
    setError(null)
    try {
      const v = await api.lookupVariantByCode(trimmed)
      setLastHit(v)
      onResolved(v)
      setValue("")
    } catch {
      setError(`No variant matches "${trimmed}"`)
    } finally {
      setBusy(false)
      // Re-focus for the next scan.
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              void submit(value)
            }
          }}
          onBlur={() => {
            // Keep focus during a scan burst so the wedge doesn't drop chars.
            if (autoFocus) {
              setTimeout(() => inputRef.current?.focus(), 100)
            }
          }}
          placeholder={placeholder}
          className="pl-9 pr-10 font-mono"
          autoComplete="off"
          spellCheck={false}
        />
        {busy ? (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        ) : value ? (
          <button
            type="button"
            onClick={() => setValue("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {!error && lastHit && (
        <p className="text-xs text-muted-foreground">
          Last: <span className="font-mono text-foreground">{lastHit.sku}</span> — {lastHit.product_title}
        </p>
      )}
    </div>
  )
}
