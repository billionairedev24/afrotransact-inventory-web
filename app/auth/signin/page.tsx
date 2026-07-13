"use client"

import { signIn } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { Suspense, useEffect } from "react"
import { Loader2 } from "lucide-react"

/**
 * Auth gate. The inventory app has exactly one identity provider (Keycloak
 * shared with the buyer + admin portals) so we don't show a provider
 * chooser — on mount we kick the buyer straight to Keycloak's authorize
 * endpoint via next-auth's signIn(). The visible splash exists only so
 * the user sees something while the redirect resolves; the explicit
 * "Try again" button is a fallback for when the browser blocks the auto
 * redirect (rare).
 */
function SignInInner() {
  const params = useSearchParams()
  const callbackUrl = params.get("callbackUrl") ?? "/"
  // If the user just signed out, do NOT auto-bounce back to Keycloak —
  // Keycloak's SSO cookie may be cleared but the user might want to land
  // on a different account, paste a different URL, or simply leave the
  // tab open. Sign-in requires a click in this state.
  const signedOut = params.get("signedOut") === "1"
  // NextAuth redirects back here with ?error= when sign-in fails (e.g. a bad
  // client secret makes the token exchange fail at the callback). Do NOT
  // auto-retry in that case — retrying silently bounces to Keycloak and back
  // into the very same failure, producing an infinite redirect loop. Surface
  // the error and require an explicit click instead.
  const authError = params.get("error")

  useEffect(() => {
    if (signedOut || authError) return
    void signIn("keycloak", { callbackUrl })
  }, [callbackUrl, signedOut, authError])

  if (authError) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm text-center">
          <h1 className="text-lg font-bold text-foreground">Couldn&rsquo;t sign you in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Something went wrong completing sign-in
            <span className="block mt-1 font-mono text-xs opacity-70">error: {authError}</span>
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            This is usually a server configuration issue. If it persists, contact an administrator.
          </p>
          <button
            type="button"
            onClick={() => void signIn("keycloak", { callbackUrl })}
            className="mt-6 w-full rounded-xl bg-brand-gold py-2.5 text-sm font-bold text-brand-gold-foreground hover:bg-brand-gold-hover transition-colors"
          >
            Try again
          </button>
        </div>
      </main>
    )
  }

  if (signedOut) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm text-center">
          <h1 className="text-lg font-bold text-foreground">You&rsquo;re signed out</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Close this tab or sign in again.
          </p>
          <button
            type="button"
            onClick={() => void signIn("keycloak", { callbackUrl })}
            className="mt-6 w-full rounded-xl bg-brand-gold py-2.5 text-sm font-bold text-brand-gold-foreground hover:bg-brand-gold-hover transition-colors"
          >
            Sign in
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground">Redirecting to sign in…</p>
        <button
          type="button"
          onClick={() => void signIn("keycloak", { callbackUrl })}
          className="mt-6 text-xs font-semibold text-muted-foreground underline hover:text-foreground"
        >
          Try again
        </button>
      </div>
    </main>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInInner />
    </Suspense>
  )
}
