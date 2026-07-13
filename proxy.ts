import { NextResponse, type NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import { AUTH_SECRET } from "@/lib/secret"

// Inventory is an admin-only app. To get in you need:
//   - a valid Keycloak session (auth gate)
//   - both the `admin` role and the `inventory` permission (authz gate)
//
// Anything else lands on /unauthorized.
//
// Auth can be turned off entirely in dev by leaving KEYCLOAK_ISSUER unset —
// in that mode the proxy short-circuits to next() so a fresh checkout boots
// without secrets. The backend's devAuthBypass mirrors this.

const REQUIRED_ROLE = "admin"
const REQUIRED_PERMISSION = "inventory:access"

// Public paths: auth callbacks, sign-in, unauthorized landing, static
// assets, and Next internals.
const PUBLIC_PREFIXES = [
  "/api/auth",
  // UploadThing's completion callback is a server-to-server POST with no
  // session cookie — gating it 307-redirects the callback and breaks uploads.
  // The route still requires the server-side UPLOADTHING_TOKEN to do anything.
  "/api/uploadthing",
  "/auth/signin",
  "/unauthorized",
  "/_next",
  "/favicon",
]

function isPublic(pathname: string): boolean {
  if (pathname === "/") return false
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))
}

// next-auth session cookie names: `__Secure-` prefixed over https, plain over
// http; a chunked (>4 KB) session adds a `.0` suffix. Presence of ANY of these
// means the user has a session — a check that needs no secret and no decode.
const SESSION_COOKIE_NAMES = [
  "__Secure-next-auth.session-token",
  "__Secure-next-auth.session-token.0",
  "next-auth.session-token",
  "next-auth.session-token.0",
]

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (isPublic(pathname)) return NextResponse.next()

  const authEnabled = Boolean(process.env.KEYCLOAK_ISSUER && process.env.KEYCLOAK_CLIENT_ID)
  if (!authEnabled) return NextResponse.next()

  // OPTIMISTIC gate (the pattern Next.js's docs recommend for proxy): redirect
  // to sign-in only when there's NO session cookie — a check that needs no
  // secret and no decode. We deliberately do NOT hard-depend on getToken() here:
  // in production this proxy returns null for a VALID session (the same cookie
  // decodes fine in Node via /api/auth/session), so blocking on it loops
  // forever. The AUTHORITATIVE check (decode + role/permission) happens in Node
  // — the app session and the backend API, which validates the same Keycloak
  // token and enforces inventory:access. (Same split the storefront uses.)
  const hasSession = SESSION_COOKIE_NAMES.some((name) => req.cookies.has(name))
  if (!hasSession) {
    const url = req.nextUrl.clone()
    url.pathname = "/auth/signin"
    url.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(url)
  }

  // Best-effort authz + diagnostics. When the proxy CAN decode (e.g. local dev),
  // enforce role/permission and bounce to /unauthorized. When it can't, log why
  // (so we can see whether the secret or the cookie name is the culprit) and
  // fall through — Node + the backend remain the source of truth.
  const secureCookie =
    req.nextUrl.protocol === "https:" ||
    req.headers.get("x-forwarded-proto") === "https"
  const token = await getToken({ req, secret: AUTH_SECRET, secureCookie })
  if (!token) {
    console.warn(
      `[auth] proxy could not decode session; deferring to Node/backend. ` +
        `path=${pathname} secretPresent=${Boolean(AUTH_SECRET)} secureCookie=${secureCookie}`,
    )
    return NextResponse.next()
  }

  // Decode roles + permissions LIVE from the raw KC access token instead
  // of trusting `token.roles / token.permissions` off the NextAuth cookie.
  // The cookie is written by the jwt() callback which only runs on sign-in
  // / refresh; permissions frozen in there don't reflect KC role assignments
  // that happened after the cookie was minted. Reading straight from
  // access_token is the source of truth.
  let roles: string[] = []
  let permissions: string[] = []
  try {
    const at = token.accessToken as string | undefined
    if (at) {
      const payload = JSON.parse(
        Buffer.from(at.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
      ) as {
        realm_access?: { roles?: string[] }
        resource_access?: Record<string, { roles?: string[] }>
        permissions?: string[]
      }
      roles = payload.realm_access?.roles ?? []
      // Union every client-role bucket. Whichever client Keycloak buckets
      // inventory:access under, we'll find it.
      const seen = new Set<string>()
      for (const v of Object.values(payload.resource_access ?? {})) {
        for (const r of v?.roles ?? []) seen.add(r)
      }
      for (const p of payload.permissions ?? []) seen.add(p)
      permissions = Array.from(seen)
    }
  } catch { /* fall through to NextAuth-cookie fallback */ }
  if (roles.length === 0) roles = (token.roles as string[] | undefined) ?? []
  if (permissions.length === 0) permissions = (token.permissions as string[] | undefined) ?? []

  if (!roles.includes(REQUIRED_ROLE) || !permissions.includes(REQUIRED_PERMISSION)) {
    console.warn(
      `[auth] denied path=${pathname} sub=${token.sub ?? "?"} email=${(token.email as string) ?? "?"} ` +
        `roles=[${roles.join(",")}] perms=[${permissions.join(",")}] ` +
        `need=role:${REQUIRED_ROLE}+perm:${REQUIRED_PERMISSION}`,
    )
    const url = req.nextUrl.clone()
    url.pathname = "/unauthorized"
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  // Run on everything except Next internals + static files. The matcher
  // also dodges the next-auth callback route via PUBLIC_PREFIXES above.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$|.*\\.png$).*)"],
}
