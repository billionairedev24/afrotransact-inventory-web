"use client"

import { SessionProvider } from "next-auth/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "sonner"
import { useState, type ReactNode } from "react"

/**
 * Single root provider. Wraps the entire app with:
 *  - SessionProvider (next-auth) so useSession works anywhere
 *  - QueryClientProvider (TanStack Query) for all data fetching + cache
 *  - Toaster (sonner) for notifications from mutations
 *
 * The QueryClient is created lazily inside the component so each browser
 * tab gets its own instance (no shared cache across tabs).
 */
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Operator surfaces want recent data but shouldn't thrash the
            // gateway. 30s stale is short enough that tab-switching feels
            // live; 5min GC keeps the cache warm between page hops.
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            retry: (failureCount, error) => {
              // Don't retry auth failures — surfaced by lib/api when 401.
              const status = (error as { status?: number } | null)?.status
              if (status === 401 || status === 403 || status === 404) return false
              return failureCount < 2
            },
          },
          mutations: {
            // Idempotency keys (see lib/api request opts) make retries safe,
            // but mutations rarely benefit from automatic retry — surface
            // the error to the user instead so they can act on it.
            retry: 0,
          },
        },
      }),
  )
  return (
    <SessionProvider>
      <QueryClientProvider client={client}>
        {children}
        <Toaster position="top-right" richColors closeButton />
      </QueryClientProvider>
    </SessionProvider>
  )
}
