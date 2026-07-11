"use client"

import { useRef, useState } from "react"
import { Plus, RefreshCw, Trash2, Check, Pencil, ImageIcon } from "lucide-react"
import { AppShell, PageHeader } from "@/components/layout/AppShell"
import { Card, CardBody } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { EmptyState } from "@/components/ui/EmptyState"
import { useMedia, useRenameMedia, useDeleteMedia, useSyncMediaFromUploadThing } from "@/lib/queries"
import { useMediaUpload } from "@/components/media/useMediaUpload"
import type { MediaAsset } from "@/lib/api"

export default function MediaLibraryPage() {
  const { data: assets, isLoading } = useMedia()
  const rename = useRenameMedia()
  const del = useDeleteMedia()
  const sync = useSyncMediaFromUploadThing()
  const { upload, isUploading } = useMediaUpload()
  const fileRef = useRef<HTMLInputElement>(null)

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
          {assets?.length ?? 0} image{(assets?.length ?? 0) === 1 ? "" : "s"}
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
          {assets!.map((a) => (
            <MediaCard
              key={a.id}
              asset={a}
              onRename={(name) => rename.mutate({ id: a.id, name })}
              onDelete={() => del.mutate(a.id)}
            />
          ))}
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
            className="group flex w-full items-center gap-1 text-left text-xs font-medium text-foreground"
            title="Click to rename"
          >
            <span className="truncate">{asset.name}</span>
            <Pencil className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
          </button>
        )}
      </CardBody>
    </Card>
  )
}
