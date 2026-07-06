"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { Bell, CheckCheck, Inbox } from "lucide-react"
import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@/lib/queries"
import { relativeTime } from "@/lib/format"
import { cn } from "@/lib/cn"

/**
 * In-app inbox bell. Click → popover with the 20 most recent notifications.
 * Unread badge polls /notifications/unread-count every 30s. Marking a
 * notification read is optimistic so the badge drops immediately.
 */
export function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { data: countResp } = useUnreadNotificationCount()
  const { data: items } = useNotifications(false)
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()
  const unread = countResp?.count ?? 0

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen((o) => !o)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-brand-gold px-1 text-[10px] font-bold leading-[18px] text-brand-gold-foreground"
            aria-label={`${unread} unread`}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-80 overflow-hidden rounded-2xl border border-border bg-popover shadow-xl">
          <header className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => void markAll.mutateAsync()}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
              >
                <CheckCheck className="h-3 w-3" /> Mark all read
              </button>
            )}
          </header>
          {items && items.length > 0 ? (
            <ul className="max-h-[400px] overflow-y-auto divide-y divide-border">
              {items.map((n) => (
                <li key={n.id} className={cn(!n.read_at && "bg-brand-gold/5")}>
                  <NotificationRow
                    n={n}
                    onClick={() => {
                      if (!n.read_at) void markRead.mutateAsync(n.id)
                      setOpen(false)
                    }}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-6 py-10 text-center">
              <Inbox className="mx-auto h-7 w-7 text-muted-foreground/40" />
              <p className="mt-2 text-xs text-muted-foreground">No notifications yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function NotificationRow({
  n,
  onClick,
}: {
  n: import("@/lib/api").NotificationModel
  onClick: () => void
}) {
  const body = (
    <div className="px-3 py-2.5 hover:bg-muted/40">
      <div className="flex items-start justify-between gap-2">
        <p className={cn("text-sm leading-snug", !n.read_at ? "font-semibold text-foreground" : "text-foreground/80")}>
          {n.title}
        </p>
        <span className="shrink-0 text-[10px] text-muted-foreground">{relativeTime(n.created_at)}</span>
      </div>
      {n.body && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.body}</p>}
    </div>
  )
  if (n.link_href) {
    return (
      <Link href={n.link_href} onClick={onClick} className="block">
        {body}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} className="block w-full text-left">
      {body}
    </button>
  )
}
