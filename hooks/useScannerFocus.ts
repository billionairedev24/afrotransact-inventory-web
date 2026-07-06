"use client"

import { useEffect, useRef } from "react"

/**
 * Single-page scanner-focus registry. Whichever ScannerInput mounts last
 * wins the global "/" hotkey — that matches what an operator expects:
 * the most-recently-rendered scanner box is the one they want to focus.
 *
 * AppShell installs the global keydown listener; pages don't have to
 * know about hotkeys at all. ScannerInput registers itself via
 * `useScannerTarget(ref)` so it's discoverable by the global hotkey.
 */

type Target = HTMLInputElement | null
let active: { current: Target } | null = null

/** Register an input as the active scanner target. Call from ScannerInput. */
export function useScannerTarget(ref: React.RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const ours = ref
    active = ours as { current: Target }
    return () => {
      if (active === ours) active = null
    }
  }, [ref])
}

/** Focus + select the active scanner input. No-op if none is registered. */
export function focusActiveScanner() {
  const el = active?.current
  if (!el) return false
  el.focus()
  el.select?.()
  return true
}

/**
 * Wire the global "/" hotkey. Mount once near the app root (AppShell).
 * Honours typing context — won't hijack "/" inside any input/textarea/
 * contenteditable, so search fields keep working.
 */
export function useGlobalScannerHotkey() {
  const installed = useRef(false)
  useEffect(() => {
    if (installed.current) return
    installed.current = true
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/") return
      const t = e.target as HTMLElement | null
      if (!t) return
      const tag = t.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable) return
      if (focusActiveScanner()) e.preventDefault()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("keydown", onKey)
      installed.current = false
    }
  }, [])
}
