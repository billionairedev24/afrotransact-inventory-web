"use client"

import { signOut as nextAuthSignOut } from "next-auth/react"

/**
 * Keycloak RP-initiated logout.
 *
 * NextAuth's `signOut()` clears the local session cookie but leaves the
 * Keycloak SSO session intact — which means our /auth/signin page (which
 * auto-redirects to Keycloak) immediately re-authenticates the user and
 * they appear "stuck" signed in. To actually log out we need to:
 *
 *   1. Clear the next-auth cookie (with redirect: false so we control
 *      the next step).
 *   2. Send the browser to Keycloak's end_session_endpoint with the
 *      stored id_token as `id_token_hint` + a `post_logout_redirect_uri`
 *      pointing back at our /auth/signin page.
 *
 * The post_logout_redirect_uri MUST be registered in the Keycloak
 * client's "Valid post logout redirect URIs" — we registered
 * `http://localhost:3010/*` as a redirect URI which Keycloak treats as
 * the post-logout list too.
 */
export async function signOutFromKeycloak(idToken: string | undefined) {
  const issuer = process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER
  // Clear next-auth's cookie locally. We don't let it redirect because
  // we want to bounce to Keycloak's end_session endpoint next.
  await nextAuthSignOut({ redirect: false })

  if (!issuer) {
    // No issuer configured (dev bypass) — just go to the signin splash.
    window.location.href = "/auth/signin"
    return
  }
  const postLogout = `${window.location.origin}/auth/signin?signedOut=1`
  const url = new URL(`${issuer}/protocol/openid-connect/logout`)
  if (idToken) url.searchParams.set("id_token_hint", idToken)
  url.searchParams.set("post_logout_redirect_uri", postLogout)
  // client_id helps Keycloak validate the post_logout_redirect_uri when
  // id_token_hint isn't trusted for some reason.
  const clientId = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID
  if (clientId) url.searchParams.set("client_id", clientId)
  window.location.href = url.toString()
}
