"use client"

import { useRef } from "react"
import { Plus, RefreshCw, X } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/Button"
import { Select } from "@/components/ui/Input"
import { useMedia, useSyncMediaFromUploadThing } from "@/lib/queries"
import { useMediaUpload } from "@/components/media/useMediaUpload"

/**
 * Adds images to a product by picking named assets from the media library via a
 * dropdown (reference by name — no re-uploading), with inline "upload new" and
 * "sync". `value` is the ordered list of selected image URLs.
 */
export function MediaPicker({
  value,
  onChange,
  max = 6,
}: {
  value: string[]
  onChange: (urls: string[]) => void
  max?: number
}) {
  const { data: assets } = useMedia()
  const sync = useSyncMediaFromUploadThing()
  const fileRef = useRef<HTMLInputElement>(null)
  const { upload, isUploading } = useMediaUpload((urls) => {
    const next = [...value]
    for (const u of urls) if (!next.includes(u) && next.length < max) next.push(u)
    onChange(next)
  })

  const nameOf = (url: string) => assets?.find((a) => a.url === url)?.name ?? url
  const available = (assets ?? []).filter((a) => !value.includes(a.url))

  function addByUrl(url: string) {
    if (url && !value.includes(url) && value.length < max) onChange([...value, url])
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label="Add image from library"
          value=""
          disabled={value.length >= max || available.length === 0}
          onChange={(e) => addByUrl(e.target.value)}
          className="min-w-0 flex-1"
        >
          <option value="">
            {value.length >= max
              ? `Maximum ${max} images`
              : available.length
                ? "Choose an image from the library…"
                : "Library is empty — upload or sync"}
          </option>
          {available.map((a) => (
            <option key={a.id} value={a.url}>{a.name}</option>
          ))}
        </Select>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const fs = Array.from(e.target.files ?? [])
            e.target.value = ""
            if (fs.length) void upload(fs)
          }}
        />
        <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()} loading={isUploading}>
          <Plus className="h-3.5 w-3.5" /> Upload
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => sync.mutate()} loading={sync.isPending}>
          <RefreshCw className="h-3.5 w-3.5" /> Sync
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <Link href="/media" className="text-xs text-muted-foreground underline-offset-2 hover:underline">
          Manage library &amp; rename images
        </Link>
        <span className="text-xs text-muted-foreground">{value.length}/{max} selected</span>
      </div>

      {value.length > 0 && (
        <ul className="space-y-1.5">
          {value.map((url, i) => (
            <li key={url} className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-bold text-muted-foreground">
                {i + 1}
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">{nameOf(url)}</span>
              <button
                type="button"
                onClick={() => onChange(value.filter((u) => u !== url))}
                className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Remove image"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
