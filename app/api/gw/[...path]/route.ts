import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"
import { AUTH_SECRET } from "@/lib/secret"

/**
 * Authenticated same-origin BFF proxy for the inventory API.
 *
 * The browser calls `/api/gw/<path>` with NO Authorization header; this handler
 * reads the Keycloak access token from the server-side session JWT (via
 * `getToken`, never exposed to the browser) and forwards the request to the
 * inventory backend with the token attached. This is the seam that lets us stop
 * putting `session.accessToken` on the client — mirrors the storefront's
 * /api/gw proxy (see project_bff_token_exposure).
 *
 * The upstream base is a SERVER-ONLY var (`INVENTORY_API_URL`); the legacy
 * `NEXT_PUBLIC_INVENTORY_API_URL` is still honored so existing deploys keep
 * working, but it should be renamed to the non-public form so the URL — and
 * with it the token boundary — stays server-side.
 *
 * Next 16: dynamic route `params` is a Promise — `await ctx.params`.
 */
function apiBase(): string {
  return (
    process.env.INVENTORY_API_URL ??
    process.env.NEXT_PUBLIC_INVENTORY_API_URL ??
    "http://localhost:8095"
  )
}

// Hop-by-hop / identity headers we must never forward. The client's own
// Authorization/Cookie are dropped — the token is (re)attached here server-side.
// X-Idempotency-Key is deliberately NOT stripped: the client mints it and the
// backend dedupes on it.
const STRIP = new Set([
  "host",
  "connection",
  "content-length",
  "authorization",
  "cookie",
  "transfer-encoding",
])

async function handle(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path } = await ctx.params
  const suffix = "/" + (path ?? []).map(encodeURIComponent).join("/")
  const url = `${apiBase()}${suffix}${req.nextUrl.search}`

  const secureCookie =
    req.nextUrl.protocol === "https:" ||
    req.headers.get("x-forwarded-proto") === "https"
  const token = await getToken({ req, secret: AUTH_SECRET, secureCookie })
  const accessToken = token?.accessToken as string | undefined

  const headers = new Headers()
  req.headers.forEach((value, key) => {
    if (!STRIP.has(key.toLowerCase())) headers.set(key, value)
  })
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`)

  const method = req.method.toUpperCase()
  const body = method === "GET" || method === "HEAD" ? undefined : await req.arrayBuffer()

  let res: Response
  try {
    res = await fetch(url, { method, headers, body, cache: "no-store", redirect: "manual" })
  } catch (err) {
    if (process.env.NEXT_PHASE !== "phase-production-build") {
      console.error(`[BFF] ${method} ${suffix} → upstream error`, err)
    }
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 })
  }

  const outHeaders = new Headers()
  res.headers.forEach((value, key) => {
    if (!STRIP.has(key.toLowerCase())) outHeaders.set(key, value)
  })
  return new NextResponse(res.body, { status: res.status, headers: outHeaders })
}

export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
}
