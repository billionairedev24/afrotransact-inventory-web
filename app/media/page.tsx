"use client"

import { useMemo, useRef, useState } from "react"
import { Plus, RefreshCw, Trash2, Check, Pencil, ImageIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { AppShell, PageHeader } from "@/components/layout/AppShell"
import { Card, CardBody } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { EmptyState } from "@/components/ui/EmptyState"
import { useMedia, useRenameMedia, useDeleteMedia, useSyncMediaFromUploadThing } from "@/lib/queries"
import { useMediaUpload } from "@/components/media/useMediaUpload"
import type { MediaAsset } from "@/lib/api"

const PAGE_SIZE = 24

export default function MediaLibraryPage() {
  const { data: assets, isLoading } = useMedia()
  const rename = useRenameMedia()
  const del = useDeleteMedia()
  const sync = useSyncMediaFromUploadThing()
  const { upload, isUploading } = useMediaUpload()
  const fileRef = useRef<HTMLInputElement>(null)

  // The API returns the whole library in one response, so the grid grew without
  // bound and became unusable once the library got past a screenful. Paginate
  // client-side: no API change, and the data is already in memory.
  const [page, setPage] = useState(0)
  const total = assets?.length ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  // Deleting the last item on the last page would otherwise strand the user on
  // an empty page with no way back.
  const safePage = Math.min(page, pageCount - 1)
  const pageAssets = useMemo(
    () => (assets ?? []).slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [assets, safePage],
  )

  return (
    <AppShell>
      <PageHeader
        title="Media library"
        subtitle="Named, reusable images. Upload once, then reference them by name when building products."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            e.target.value = ""
            if (files.length) void upload(files)
          }}
        />
        <Button onClick={() => fileRef.current?.click()} loading={isUploading}>
          <Plus className="h-4 w-4" /> Upload images
        </Button>
        <Button variant="secondary" onClick={() => sync.mutate()} loading={sync.isPending}>
          <RefreshCw className="h-4 w-4" /> Sync from UploadThing
        </Button>
        <span className="ml-auto text-sm text-muted-foreground">
          {total === 0
            ? "No images"
            : `${safePage * PAGE_SIZE + 1}–${Math.min((safePage + 1) * PAGE_SIZE, total)} of ${total} image${total === 1 ? "" : "s"}`}
        </span>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (assets?.length ?? 0) === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="No images yet"
          body="Upload images or sync the ones already in UploadThing to start your library."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {pageAssets.map((a) => (
            <MediaCard
              key={a.id}
              asset={a}
              onRename={(name) => rename.mutate({ id: a.id, name })}
              onDelete={() => del.mutate(a.id)}
            />
          ))}
        </div>
      )}

      {pageCount > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={safePage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </Button>
          <span className="text-sm text-muted-foreground" aria-live="polite">
            Page {safePage + 1} of {pageCount}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </AppShell>
  )
}

function MediaCard({
  asset,
  onRename,
  onDelete,
}: {
  asset: MediaAsset
  onRename: (name: string) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(asset.name)

  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-square bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset.url} alt={asset.name} className="h-full w-full object-cover" />
        <button
          type="button"
          onClick={onDelete}
          className="absolute right-1.5 top-1.5 rounded-md bg-black/60 p-1 text-white hover:bg-black/80"
          aria-label="Remove from library"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <CardBody className="p-2">
        {editing ? (
          <div className="flex items-center gap-1">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 text-xs"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") { onRename(name.trim() || asset.name); setEditing(false) }
                if (e.key === "Escape") { setName(asset.name); setEditing(false) }
              }}
            />
            <button
              type="button"
              onClick={() => { onRename(name.trim() || asset.name); setEditing(false) }}
              className="rounded-md p-1 text-primary hover:bg-muted"
              aria-label="Save name"
            >
              <Check className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left text-xs font-medium text-foreground hover:bg-muted"
            title="Rename this image"
          >
            <span className="min-w-0 flex-1 truncate">{asset.name}</span>
            <Pencil className="h-3 w-3 shrink-0 text-muted-foreground" />
          </button>
        )}
      </CardBody>
    </Card>
  )
}
