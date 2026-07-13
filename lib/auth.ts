import KeycloakProvider from "next-auth/providers/keycloak"
import type { AuthOptions } from "next-auth"
import { AUTH_SECRET } from "./secret"

/**
 * NextAuth configuration. Keycloak in production (via env), passthrough in
 * dev so a fresh checkout boots without secrets. When env vars are absent
 * we don't register any provider — the SessionProvider still renders, but
 * routes that read the session see a null and the API client falls back to
 * the backend's devAuthBypass principal.
 *
 * Required env for prod:
 *   KEYCLOAK_ISSUER         e.g. https://auth.afrotransact.com/realms/afrotransact
 *   KEYCLOAK_CLIENT_ID      e.g. at-inv
 *   KEYCLOAK_CLIENT_SECRET  (confidential client only)
 *   NEXTAUTH_SECRET         random string
 */

const issuer = process.env.KEYCLOAK_ISSUER
const clientId = process.env.KEYCLOAK_CLIENT_ID
const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET

export const authEnabled = Boolean(issuer && clientId)

// Fail loud instead of looping silently: if auth is on but no secret resolved
// under ANY accepted name, the session cookie can't be sealed/read and every
// request bounces to sign-in. Surface it in the logs at startup.
if (authEnabled && !AUTH_SECRET) {
  console.error(
    "[auth] No session secret found. Set NEXTAUTH_SECRET (canonical) in the " +
      "environment — auth cannot sign/verify session cookies without it.",
  )
}

// Authorisation rule for the inventory app:
//   - realm role `admin`           — identity (who you are)
//   - permission `inventory:access` — capability (what you can do here)
// Both required. Sellers, plain admins without inventory:access, and
// unauthenticated users land on /unauthorized via middleware.ts.
export const REQUIRED_ROLE = "admin"
export const REQUIRED_PERMISSION = "inventory:access"

export function hasInventoryAccess(
  roles: string[] | undefined | null,
  permissions: string[] | undefined | null,
): boolean {
  const r = roles ?? []
  const p = permissions ?? []
  return r.includes(REQUIRED_ROLE) && p.includes(REQUIRED_PERMISSION)
}

interface DecodedClaims {
  roles: string[]
  permissions: string[]
}

function decodeClaims(accessToken: string | undefined): DecodedClaims {
  const empty: DecodedClaims = { roles: [], permissions: [] }
  if (!accessToken) return empty
  try {
    const parts = accessToken.split(".")
    if (parts.length < 2) return empty
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
    ) as {
      realm_access?: { roles?: string[] }
      resource_access?: Record<string, { roles?: string[] }>
      permissions?: string[]
    }
    const roles = payload.realm_access?.roles ?? []
    // Client-roles on this app's Keycloak client are this app's permissions.
    // Also union client-roles from every other client in resource_access so
    // client roles that Keycloak buckets under a different client id (e.g.
    // when the token was minted for a companion client but this app shares
    // the realm) still count as permissions here.
    const primaryClientPerms = clientId ? payload.resource_access?.[clientId]?.roles ?? [] : []
    const allResourcePerms: string[] = []
    for (const [, v] of Object.entries(payload.resource_access ?? {})) {
      for (const r of v?.roles ?? []) allResourcePerms.push(r)
    }
    const explicitPerms = payload.permissions ?? []
    const permissions = Array.from(new Set([...primaryClientPerms, ...allResourcePerms, ...explicitPerms]))
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[auth] decodeClaims clientId=${clientId} keys=[${Object.keys(payload.resource_access ?? {}).join(",")}] ` +
          `primaryPerms=[${primaryClientPerms.join(",")}] allResourcePerms=[${allResourcePerms.join(",")}] ` +
          `finalPermissions=[${permissions.join(",")}]`,
      )
    }
    return {
      roles: Array.from(new Set(roles)),
      permissions,
    }
  } catch {
    return empty
  }
}

export const authOptions: AuthOptions = {
  providers: authEnabled
    ? [
        KeycloakProvider({
          issuer: issuer!,
          clientId: clientId!,
          clientSecret: clientSecret ?? "",
        }),
      ]
    : [],
  // Set explicitly (not left to NextAuth's NEXTAUTH_SECRET auto-pickup) so a
  // differently-spelled env var name can't leave the app secret-less.
  secret: AUTH_SECRET,
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account }) {
      // Initial sign-in: capture everything Keycloak returned.
      if (account?.access_token) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.expiresAt = account.expires_at
        const { roles, permissions } = decodeClaims(account.access_token)
        token.roles = roles
        token.permissions = permissions
        // Deliberately do NOT persist id_token. access + refresh already push
        // the encrypted NextAuth cookie close to the 4 KB single-cookie limit;
        // adding id_token tips it over, so Next chunks it into
        // __Secure-next-auth.session-token.0/.1 — and the Edge proxy's
        // getToken() then fails to reassemble it, bouncing an authenticated
        // user to /auth/signin in an infinite loop. (Same fix the storefront
        // already shipped.) Signout still works via client_id — see lib/signout.ts.
        return token
      }

      // Always re-derive roles/permissions from the current access token
      // on every call. Fixes stale NextAuth JWT cookies that were minted
      // before a decodeClaims change or before a Keycloak role assignment.
      if (typeof token.accessToken === "string") {
        const { roles, permissions } = decodeClaims(token.accessToken)
        token.roles = roles
        token.permissions = permissions
      }

      // Subsequent calls: if the access token is close to expiring (or
      // already expired), roll it forward with the refresh token. Keycloak
      // re-runs role mappers on refresh, so newly-assigned client roles
      // (inventory:access, inventory:approve) show up without the buyer
      // having to sign out and back in.
      const expiresAt = typeof token.expiresAt === "number" ? token.expiresAt : 0
      const nowSec = Math.floor(Date.now() / 1000)
      const shouldRefresh = expiresAt > 0 && expiresAt - nowSec < 60 && typeof token.refreshToken === "string"
      if (shouldRefresh) {
        try {
          const params = new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: token.refreshToken as string,
            client_id: clientId ?? "",
          })
          if (clientSecret) params.set("client_secret", clientSecret)
          const res = await fetch(`${issuer}/protocol/openid-connect/token`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params.toString(),
          })
          if (res.ok) {
            const j = (await res.json()) as {
              access_token: string
              refresh_token?: string
              expires_in?: number
              id_token?: string
            }
            token.accessToken = j.access_token
            if (j.refresh_token) token.refreshToken = j.refresh_token
            // id_token intentionally not persisted — see the sign-in branch above.
            token.expiresAt = nowSec + (j.expires_in ?? 300)
            const { roles, permissions } = decodeClaims(j.access_token)
            token.roles = roles
            token.permissions = permissions
          }
        } catch {
          // Refresh failed — leave the old token; middleware will bounce
          // to signin when the access token can't validate.
        }
      }
      return token
    },
    async session({ session, token }) {
      const s = session as { accessToken?: string; roles?: string[]; permissions?: string[] }
      s.accessToken = token.accessToken as string | undefined
      s.roles = (token.roles as string[] | undefined) ?? []
      s.permissions = (token.permissions as string[] | undefined) ?? []
      return session
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
}
