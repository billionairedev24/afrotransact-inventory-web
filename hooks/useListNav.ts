"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

/**
 * Keyboard nav for operator list pages.
 *
 *   j / ArrowDown — move cursor down
 *   k / ArrowUp   — move cursor up
 *   Enter         — open the row at the cursor (via hrefFor)
 *   g g           — jump to first row
 *   G             — jump to last row
 *
 * Ignored while the user is typing in an input/textarea/select or anything
 * contenteditable, so search bars + form fields keep working.
 *
 * Returns the active index so callers can highlight the row visually.
 */
export function useListNav<T>(
  items: T[],
  hrefFor: (item: T) => string | null,
): number {
  const router = useRouter()
  const [active, setActive] = useState(0)

  // Reset cursor when the list shrinks past it (e.g. after filtering).
  useEffect(() => {
    if (active >= items.length) setActive(Math.max(0, items.length - 1))
  }, [items.length, active])

  useEffect(() => {
    let lastG = 0
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (t) {
        const tag = t.tagName
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable) return
      }
      if (items.length === 0) return
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault()
        setActive((i) => Math.min(items.length - 1, i + 1))
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault()
        setActive((i) => Math.max(0, i - 1))
      } else if (e.key === "Enter") {
        const item = items[active]
        if (!item) return
        const href = hrefFor(item)
        if (href) {
          e.preventDefault()
          router.push(href)
        }
      } else if (e.key === "G") {
        e.preventDefault()
        setActive(items.length - 1)
      } else if (e.key === "g") {
        const now = Date.now()
        if (now - lastG < 400) {
          e.preventDefault()
          setActive(0)
          lastG = 0
        } else {
          lastG = now
        }
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [items, active, hrefFor, router])

  return active
}
