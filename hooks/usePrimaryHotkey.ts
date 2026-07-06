"use client"

import { useEffect } from "react"

/**
 * Fires the page's primary action on Cmd/Ctrl+Enter. Use it once per
 * detail page to wire the dominant CTA — "Start picking", "Mark packed",
 * "Receive PO", "Process return", etc. — to a single keystroke.
 *
 * Skips when the user is mid-edit in a textarea (newlines belong there)
 * but ALLOWS Cmd/Ctrl+Enter from a focused input — the standard "submit
 * from a form field" intent. Set `disabled` to no-op while a transition
 * is already in flight.
 */
export function usePrimaryHotkey(handler: () => void, disabled?: boolean) {
  useEffect(() => {
    if (disabled) return
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Enter") return
      if (!(e.metaKey || e.ctrlKey)) return
      const t = e.target as HTMLElement | null
      if (t?.tagName === "TEXTAREA") return
      e.preventDefault()
      handler()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [handler, disabled])
}
