/**
 * The single source of truth for NextAuth's session secret.
 *
 * NextAuth only ever looks at `NEXTAUTH_SECRET` by convention. If the deploy
 * environment spells it differently (e.g. `NEXT_AUTH_SECRET`), NextAuth sees
 * nothing, can't seal/read the session cookie, and every authenticated request
 * bounces to sign-in — an infinite loop with no obvious error. To make that
 * class of naming slip impossible, resolve the secret from every accepted
 * spelling here and pass it EXPLICITLY to both `authOptions.secret` and the
 * middleware's `getToken({ secret })`.
 *
 * `||` (not `??`) so an empty-string value also falls through to the next name.
 * Canonical remains `NEXTAUTH_SECRET`; the others are tolerated fallbacks.
 */
export const AUTH_SECRET: string | undefined =
  process.env.NEXTAUTH_SECRET ||
  process.env.NEXT_AUTH_SECRET ||
  process.env.AUTH_SECRET ||
  undefined
