"use client"

import { useState } from "react"
import { toast } from "sonner"
import { useUploadThing } from "@/lib/uploadthing"
import { useRegisterMedia } from "@/lib/queries"

/**
 * Uploads image files to UploadThing (shared AfroTransact app) and registers
 * each into the inventory media library so it becomes a named, reusable asset.
 * Returns the registered URLs to the caller.
 */
export function useMediaUpload(onRegistered?: (urls: string[]) => void) {
  const register = useRegisterMedia()
  const [isUploading, setIsUploading] = useState(false)

  const { startUpload } = useUploadThing("productImage", {
    onClientUploadComplete: async (res) => {
      const items = (res ?? [])
        .map((f) => {
          const r = f as unknown as { ufsUrl?: string; url?: string; key?: string; name?: string; size?: number }
          const url = r.ufsUrl || r.url || (r.key ? `https://utfs.io/f/${r.key}` : "")
          return { url, ut_key: r.key, name: r.name, size_bytes: r.size }
        })
        .filter((x) => x.url)
      const urls: string[] = []
      for (const it of items) {
        try {
          const saved = await register.mutateAsync(it)
          urls.push(saved.url)
        } catch {
          /* toast handled by the mutation */
        }
      }
      setIsUploading(false)
      if (urls.length) onRegistered?.(urls)
    },
    onUploadError: (e) => {
      setIsUploading(false)
      toast.error(e.message || "Upload failed")
    },
  })

  async function upload(files: File[]) {
    const imgs = files.filter((f) => f.type.startsWith("image/"))
    if (imgs.length === 0) {
      toast.error("Please choose image files.")
      return
    }
    setIsUploading(true)
    await startUpload(imgs)
  }

  return { upload, isUploading }
}
