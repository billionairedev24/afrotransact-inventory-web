import { NextResponse } from "next/server"
import { UTApi } from "uploadthing/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

const utapi = new UTApi()

/**
 * Lists every file in the shared AfroTransact UploadThing app and returns them
 * as media-asset inputs, so the client can import them into the inventory media
 * library (idempotent by URL on the backend). Admin-gated — the portal already
 * sits behind proxy.ts middleware; we re-check the session here defensively.
 */
export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) return new NextResponse("unauthorized", { status: 401 })
  try {
    const { files } = await utapi.listFiles({ limit: 500 })
    const assets = files
      .filter((f) => f.status === "Uploaded")
      .map((f) => ({
        url: `https://utfs.io/f/${f.key}`,
        ut_key: f.key,
        name: f.name ?? f.key,
      }))
    return NextResponse.json(assets)
  } catch (e) {
    return new NextResponse(e instanceof Error ? e.message : "sync failed", { status: 502 })
  }
}
