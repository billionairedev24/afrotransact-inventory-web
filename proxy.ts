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

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (isPublic(pathname)) return NextResponse.next()

  const authEnabled = Boolean(process.env.KEYCLOAK_ISSUER && process.env.KEYCLOAK_CLIENT_ID)
  if (!authEnabled) return NextResponse.next()

  // In Next.js 16 the proxy runs on the Node.js runtime (not Edge), so
  // getToken() has full access to runtime env vars — including Sensitive ones —
  // and full crypto, and can authoritatively decode the session right here.
  //
  // secureCookie is pinned to the request scheme instead of getToken's default
  // NEXTAUTH_URL/VERCEL sniffing, so it always looks for the correct cookie
  // name (`__Secure-` prefixed over https). AUTH_SECRET resolves the signing
  // secret from any accepted env-var spelling (see lib/secret.ts).
  const secureCookie =
    req.nextUrl.protocol === "https:" ||
    req.headers.get("x-forwarded-proto") === "https"
  const token = await getToken({ req, secret: AUTH_SECRET, secureCookie })

  if (!token) {
    const url = req.nextUrl.clone()
    url.pathname = "/auth/signin"
    url.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(url)
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
