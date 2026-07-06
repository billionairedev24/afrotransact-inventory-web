"use client"

import {
  Fragment,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreHorizontal,
  Search,
  X,
} from "lucide-react"
import { cn } from "@/lib/cn"

/**
 * Operator data-table.
 *
 * Built-ins (each is opt-in via props):
 *   - search          — client-side filter using a custom matcher
 *   - pagination      — 25/50/100 page sizes, prev/next/first/last
 *   - selection       — checkbox column + bulk-action bar slot
 *   - row actions     — "⋯" kebab per row that opens a popover menu
 *   - active row      — j/k highlight from useListNav (still works)
 *   - footer slot     — kbd hints / totals / pagination chrome
 *
 * Everything is generic on T so type narrowing stays clean at the call site.
 */

export interface TableColumn<T> {
  key: string
  header: ReactNode
  cell: (row: T, i: number) => ReactNode
  align?: "left" | "right" | "center"
  width?: string
  cellClass?: string
  srOnlyHeader?: boolean
}

export interface RowAction<T> {
  label: string
  /** Optional destructive styling. */
  destructive?: boolean
  /** Called with the row. Return a Promise to await before closing menu. */
  onSelect: (row: T) => void | Promise<void>
  /** Hide this action for specific rows. */
  hidden?: (row: T) => boolean
}

export interface TableProps<T> {
  columns: TableColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string

  /* Search */
  searchPlaceholder?: string
  /** Matcher receives the lower-cased query; return true to include the row. */
  searchMatch?: (row: T, q: string) => boolean

  /* Pagination */
  pageSizes?: number[]
  defaultPageSize?: number

  /* Selection (bulk actions) */
  selectable?: boolean
  /** Renders above the table when ≥1 row is selected. Receives the selected rows. */
  bulkActions?: (selected: T[], clear: () => void) => ReactNode

  /* Row CRUD menu (kebab) */
  rowActions?: RowAction<T>[]

  /* Visual + kbd */
  activeIndex?: number
  onRowClick?: (row: T) => void
  empty?: ReactNode
  footer?: ReactNode
  className?: string
}

const alignClass = (a?: "left" | "right" | "center") =>
  a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left"

export function Table<T>({
  columns,
  rows,
  rowKey,
  searchPlaceholder,
  searchMatch,
  pageSizes = [25, 50, 100],
  defaultPageSize,
  selectable,
  bulkActions,
  rowActions,
  activeIndex,
  onRowClick,
  empty,
  footer,
  className,
}: TableProps<T>) {
  const [q, setQ] = useState("")
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(defaultPageSize ?? pageSizes[0])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [menuFor, setMenuFor] = useState<string | null>(null)

  // Reset paging when the underlying list shrinks (filter, refetch).
  useEffect(() => {
    setPage(0)
  }, [q, pageSize])

  // ── Derive filtered + paged view ──────────────────────────────────────
  const filtered = useMemo(() => {
    if (!searchMatch || !q.trim()) return rows
    const needle = q.trim().toLowerCase()
    return rows.filter((r) => searchMatch(r, needle))
  }, [rows, q, searchMatch])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageRows = useMemo(
    () => filtered.slice(page * pageSize, page * pageSize + pageSize),
    [filtered, page, pageSize],
  )

  // ── Selection helpers ─────────────────────────────────────────────────
  const allOnPageSelected =
    selectable && pageRows.length > 0 && pageRows.every((r) => selected.has(rowKey(r)))
  const someOnPageSelected =
    selectable && pageRows.some((r) => selected.has(rowKey(r))) && !allOnPageSelected

  function toggleAllOnPage() {
    const next = new Set(selected)
    if (allOnPageSelected) {
      for (const r of pageRows) next.delete(rowKey(r))
    } else {
      for (const r of pageRows) next.add(rowKey(r))
    }
    setSelected(next)
  }
  function toggleOne(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }
  function clearSelection() {
    setSelected(new Set())
  }

  const selectedRows = useMemo(
    () => rows.filter((r) => selected.has(rowKey(r))),
    [rows, selected, rowKey],
  )

  return (
    <div className={cn("space-y-3", className)}>
      {/* ── Toolbar: search + bulk-action ─────────────────────────────── */}
      {(searchMatch || (selectable && selectedRows.length > 0)) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {searchMatch && (
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={searchPlaceholder ?? "Search…"}
                className="h-8 w-full rounded-lg border border-border bg-card pl-8 pr-7 text-sm placeholder:text-muted-foreground/60 focus:border-brand-gold focus:outline-none focus:ring-2 focus:ring-brand-gold/30"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
          {selectable && selectedRows.length > 0 && bulkActions && (
            <div className="flex items-center gap-2 rounded-lg border border-brand-gold/40 bg-brand-gold/10 px-2.5 py-1.5 text-xs">
              <span className="font-semibold">{selectedRows.length} selected</span>
              {bulkActions(selectedRows, clearSelection)}
              <button
                type="button"
                onClick={clearSelection}
                className="text-muted-foreground hover:text-foreground underline"
              >
                clear
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Table ─────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                {selectable && (
                  <th className="w-10 px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label="Select all on page"
                      checked={Boolean(allOnPageSelected)}
                      ref={(el) => {
                        if (el) el.indeterminate = Boolean(someOnPageSelected)
                      }}
                      onChange={toggleAllOnPage}
                      className="cursor-pointer"
                    />
                  </th>
                )}
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className={cn(
                      "px-3 py-2 font-semibold",
                      alignClass(c.align),
                      c.width,
                      c.srOnlyHeader && "sr-only",
                    )}
                  >
                    {c.header}
                  </th>
                ))}
                {rowActions && <th className="w-10 px-3 py-2 sr-only">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pageRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)}
                    className="px-3 py-10 text-center text-sm text-muted-foreground"
                  >
                    {q && searchMatch
                      ? `No rows match "${q}"`
                      : (empty ?? "No rows")}
                  </td>
                </tr>
              ) : (
                pageRows.map((row, i) => {
                  const id = rowKey(row)
                  // Map page-relative index back to the unfiltered list so
                  // activeIndex from useListNav still highlights correctly
                  // when the caller passes the raw `rows` to that hook.
                  const absoluteIdx = page * pageSize + i
                  return (
                    <tr
                      key={id}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      className={cn(
                        "hover:bg-muted/30",
                        activeIndex === absoluteIdx && "bg-brand-gold/10",
                        selected.has(id) && "bg-brand-gold/5",
                        onRowClick && "cursor-pointer",
                      )}
                    >
                      {selectable && (
                        <td className="w-10 px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            aria-label="Select row"
                            checked={selected.has(id)}
                            onChange={() => toggleOne(id)}
                            className="cursor-pointer"
                          />
                        </td>
                      )}
                      {columns.map((c) => (
                        <td
                          key={c.key}
                          className={cn("px-3 py-2", alignClass(c.align), c.cellClass)}
                        >
                          {c.cell(row, absoluteIdx)}
                        </td>
                      ))}
                      {rowActions && (
                        <td className="w-10 px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                          <RowMenu
                            row={row}
                            actions={rowActions}
                            open={menuFor === id}
                            setOpen={(o) => setMenuFor(o ? id : null)}
                          />
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination strip ─────────────────────────────────────────── */}
        {filtered.length > pageSize && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/20 px-3 py-1.5 text-xs">
            <p className="text-muted-foreground">
              {page * pageSize + 1}–{Math.min(filtered.length, (page + 1) * pageSize)}{" "}
              of {filtered.length}
            </p>
            <div className="flex items-center gap-2">
              <label className="text-muted-foreground">
                Rows
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(parseInt(e.target.value, 10))}
                  className="ml-1.5 h-6 rounded border border-border bg-card px-1 text-xs"
                >
                  {pageSizes.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
              <span className="flex items-center gap-0.5">
                <PagerBtn onClick={() => setPage(0)} disabled={page === 0} aria-label="First page">
                  <ChevronsLeft className="h-3.5 w-3.5" />
                </PagerBtn>
                <PagerBtn onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} aria-label="Previous page">
                  <ChevronLeft className="h-3.5 w-3.5" />
                </PagerBtn>
                <span className="px-1.5 tabular-nums">{page + 1} / {totalPages}</span>
                <PagerBtn onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} aria-label="Next page">
                  <ChevronRight className="h-3.5 w-3.5" />
                </PagerBtn>
                <PagerBtn onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1} aria-label="Last page">
                  <ChevronsRight className="h-3.5 w-3.5" />
                </PagerBtn>
              </span>
            </div>
          </div>
        )}

        {footer && (
          <div className="border-t border-border bg-muted/20 px-3 py-1.5 text-[10px] text-muted-foreground">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

/** Reusable keyboard-hint strip for list-page footers. */
export function TableKbdHint() {
  return (
    <>
      <kbd className="font-mono">j</kbd>/<kbd className="font-mono">k</kbd> to move ·{" "}
      <kbd className="font-mono">Enter</kbd> to open ·{" "}
      <kbd className="font-mono">/</kbd> to focus scanner
    </>
  )
}

function PagerBtn({
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className="inline-flex h-6 w-6 items-center justify-center rounded border border-border bg-card text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  )
}

/**
 * RowMenu — fixed-positioned dropdown rendered through a portal so it
 * never clips on the last rows of a long table. On open we measure the
 * trigger's bounding rect; the menu opens DOWN if there's room below the
 * trigger, otherwise it flips UP. Horizontal alignment is right-edge-of-
 * trigger by default; if it would overflow the viewport, it sticks to
 * the left edge instead.
 *
 * Closes on outside click, Escape, scroll, or window resize.
 */
function RowMenu<T>({
  row,
  actions,
  open,
  setOpen,
}: {
  row: T
  actions: RowAction<T>[]
  open: boolean
  setOpen: (o: boolean) => void
}) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  const visible = actions.filter((a) => !a.hidden?.(row))

  // Compute position after open so we can measure the menu's rendered size.
  useEffect(() => {
    if (!open) { setPos(null); return }
    const trig = triggerRef.current
    if (!trig) return

    function place() {
      if (!trig) return
      const t = trig.getBoundingClientRect()
      // Use the actual rendered menu size when available; fall back to an
      // estimate (one row ≈ 32px + 4px padding) so the first paint is close.
      const estHeight = Math.max(40, visible.length * 30 + 12)
      const menuH = menuRef.current?.offsetHeight ?? estHeight
      const menuW = menuRef.current?.offsetWidth  ?? 192 // matches w-48 below
      const spaceBelow = window.innerHeight - t.bottom
      const spaceAbove = t.top
      // Open up when there's clearly not enough room below AND there's more
      // room above; otherwise stay down.
      const openUp = spaceBelow < menuH + 8 && spaceAbove > spaceBelow
      const top = openUp ? Math.max(8, t.top - menuH - 4) : Math.min(window.innerHeight - menuH - 8, t.bottom + 4)
      let left = t.right - menuW
      if (left < 8) left = 8
      if (left + menuW > window.innerWidth - 8) left = window.innerWidth - menuW - 8
      setPos({ top, left })
    }
    place()
    // Re-measure once the menu is actually in the DOM (next frame).
    const raf = requestAnimationFrame(place)
    window.addEventListener("scroll", () => setOpen(false), { capture: true, once: true })
    window.addEventListener("resize", () => setOpen(false), { once: true })
    return () => cancelAnimationFrame(raf)
  }, [open, visible.length, setOpen])

  // Outside-click + Escape.
  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      if (menuRef.current?.contains(t)) return
      if (triggerRef.current?.contains(t)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDoc)
      document.removeEventListener("keydown", onKey)
    }
  }, [open, setOpen])

  if (visible.length === 0) return null

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Row actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && pos && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          role="menu"
          // Explicit opaque background — bg-popover relies on a CSS var
          // that didn't always paint solidly when portaled to document.body
          // outside the app's theme container. White is the safe default;
          // dark-mode override sits next to it.
          style={{ position: "fixed", top: pos.top, left: pos.left, backgroundColor: "white" }}
          className="z-50 w-48 overflow-hidden rounded-lg border border-border shadow-xl dark:!bg-neutral-900"
        >
          {visible.map((a, idx) => (
            <Fragment key={idx}>
              <button
                type="button"
                role="menuitem"
                onClick={async () => {
                  await a.onSelect(row)
                  setOpen(false)
                }}
                className={cn(
                  "block w-full px-3 py-2 text-left text-xs transition-colors hover:bg-muted",
                  a.destructive && "text-red-600 hover:bg-red-50",
                )}
              >
                {a.label}
              </button>
            </Fragment>
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}
