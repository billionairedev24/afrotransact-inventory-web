import { createUploadthing, type FileRouter } from "uploadthing/next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

const f = createUploadthing()

// The inventory portal is admin-gated by proxy.ts; we don't hard-fail here so
// uploads work in dev (no session) too. Identity is best-effort for tagging.
async function tag() {
  const session = await getServerSession(authOptions)
  return { userId: session?.user?.email ?? "operator" }
}

export const ourFileRouter = {
  productImage: f({
    "image/png": { maxFileSize: "4MB", maxFileCount: 3 },
    "image/jpeg": { maxFileSize: "4MB", maxFileCount: 3 },
    "image/webp": { maxFileSize: "4MB", maxFileCount: 3 },
  })
    .middleware(tag)
    .onUploadComplete(({ file }) => ({ url: file.ufsUrl })),
} satisfies FileRouter

export type OurFileRouter = typeof ourFileRouter
