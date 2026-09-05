import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"
import { AUTH_SECRET } from "@/lib/secret"

/**
 * Server-side Keycloak RP-initiated (end-session) logout. Mirrors the
 * storefront's proven flow: the only way to clear Keycloak's own SSO cookie
 * (KEYCLOAK_IDENTITY) is to navigate the BROWSER to Keycloak's end-session
 * endpoint — a server-side fetch carries none of the browser's cookies. We also
 * expire every NextAuth cookie variant here (a client signOut can miss the
 * domain-scoped / chunked ones), so nothing silently re-authenticates.
 */
const useSecureCookies = (process.env.NEXTAUTH_URL ?? "").startsWith("https://")

function cookieDomain(): string | undefined {
  if (!useSecureCookies) return undefined
  try {
    const host = new URL(process.env.NEXTAUTH_URL ?? "").hostname
    return host === "afrotransact.com" || host.endsWith(".afrotransact.com") ? ".afrotransact.com" : undefined
  } catch {
    return undefined
  }
}

function appendExpired(res: NextResponse, name: string, domain?: string) {
  if (domain && name.startsWith("__Host-")) return
  const parts = [`${name}=`, "Path=/", "Max-Age=0", "Expires=Thu, 01 Jan 1970 00:00:00 GMT", "SameSite=Lax"]
  if (domain) parts.push(`Domain=${domain}`)
  if (useSecureCookies) parts.push("Secure")
  parts.push("HttpOnly")
  res.headers.append("Set-Cookie", parts.join("; "))
}

function clearNextAuthCookies(req: NextRequest, res: NextResponse) {
  const domain = cookieDomain()
  const names = new Set<string>([
    "next-auth.session-token",
    "next-auth.session-token.0",
    "next-auth.csrf-token",
    "next-auth.callback-url",
    "__Secure-next-auth.session-token",
    "__Secure-next-auth.session-token.0",
    "__Secure-next-auth.csrf-token",
    "__Secure-next-auth.callback-url",
    "__Host-next-auth.csrf-token",
  ])
  for (const c of req.cookies.getAll()) {
    if (c.name.startsWith("next-auth") || c.name.startsWith("__Secure-next-auth") || c.name.startsWith("__Host-next-auth")) {
      names.add(c.name)
    }
  }
  for (const n of names) {
    appendExpired(res, n)
    if (domain) appendExpired(res, n, domain)
  }
}

async function keycloakLogoutUrl(req: NextRequest): Promise<string> {
  const base = (process.env.NEXTAUTH_URL || "http://localhost:3010").replace(/\/+$/, "")
  const postLogout = `${base}/auth/signin?signedOut=1`
  const issuer = process.env.KEYCLOAK_ISSUER
  if (!issuer) return postLogout
  const url = new URL(`${issuer.replace(/\/+$/, "")}/protocol/openid-connect/logout`)
  url.searchParams.set("client_id", process.env.KEYCLOAK_CLIENT_ID || "afrotransact-web")
  url.searchParams.set("post_logout_redirect_uri", postLogout)
  // id_token_hint makes Keycloak log out silently (no confirmation page). We
  // don't persist the id_token (keeps the cookie small), so it's usually absent
  // and Keycloak validates via client_id + a registered post-logout redirect URI.
  const secureCookie = req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https"
  const token = await getToken({ req, secret: AUTH_SECRET, secureCookie })
  if (token?.idToken) url.searchParams.set("id_token_hint", String(token.idToken))
  return url.toString()
}

// GET — hard navigation from the "Sign out" link. 302 the browser to Keycloak's
// end-session so the SSO cookie is cleared, then back to the signed-out splash.
export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(await keycloakLogoutUrl(req), { status: 302 })
  clearNextAuthCookies(req, res)
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate")
  return res
}

// POST — for a client-driven signOut(): returns { url } for the browser to
// navigate to (a plain 302 followed by fetch wouldn't carry the KC SSO cookie).
export async function POST(req: NextRequest) {
  const res = NextResponse.json({ url: await keycloakLogoutUrl(req) })
  clearNextAuthCookies(req, res)
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate")
  return res
}
