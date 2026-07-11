"use client"

import { useRef } from "react"
import { Plus, RefreshCw } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/Button"
import { useMedia, useSyncMediaFromUploadThing } from "@/lib/queries"
import { useMediaUpload } from "@/components/media/useMediaUpload"

/**
 * Selects images for a product from the shared media library (reference named
 * assets instead of re-uploading), with an inline "upload new" that lands in the
 * library too. `value` is the ordered list of selected image URLs.
 */
export function MediaPicker({
  value,
  onChange,
  max = 5,
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

  function toggle(url: string) {
    if (value.includes(url)) onChange(value.filter((u) => u !== url))
    else if (value.length < max) onChange([...value, url])
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
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
          <Plus className="h-3.5 w-3.5" /> Upload new
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => sync.mutate()} loading={sync.isPending}>
          <RefreshCw className="h-3.5 w-3.5" /> Sync UploadThing
        </Button>
        <Link href="/media" className="text-xs text-muted-foreground underline-offset-2 hover:underline">
          Manage library
        </Link>
        <span className="ml-auto text-xs text-muted-foreground">{value.length}/{max} selected</span>
      </div>

      {(assets?.length ?? 0) === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
          Library is empty — upload an image or sync from UploadThing.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {assets!.map((a) => {
            const selected = value.includes(a.url)
            const order = value.indexOf(a.url) + 1
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => toggle(a.url)}
                title={a.name}
                className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-colors ${
                  selected ? "border-primary" : "border-transparent hover:border-border"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt={a.name} className="h-full w-full object-cover" />
                {selected && (
                  <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-black">
                    {order}
                  </span>
                )}
                <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1 py-0.5 text-[10px] text-white">
                  {a.name}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
