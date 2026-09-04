import { createUploadthing, type FileRouter } from "uploadthing/next"
import { UploadThingError } from "uploadthing/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

const f = createUploadthing()

// This middleware runs on the client-initiated upload request, which carries
// the operator's session cookie — so it's the right place to enforce auth.
// In production a missing session is REJECTED (an unauthenticated /api/uploadthing
// would otherwise let anyone burn our live UploadThing storage/quota). In dev we
// stay permissive so uploads work without secrets. The server-to-server
// onUploadComplete callback has no cookie but never reaches this check.
async function tag() {
  const session = await getServerSession(authOptions)
  if (!session?.user && process.env.NODE_ENV === "production") {
    throw new UploadThingError("Unauthorized")
  }
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
