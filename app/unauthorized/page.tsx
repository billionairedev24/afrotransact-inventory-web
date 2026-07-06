"use client"

import { useSession } from "next-auth/react"
import { ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { signOutFromKeycloak } from "@/lib/signout"

export default function UnauthorizedPage() {
  const { data: session } = useSession()
  const idToken = (session as { idToken?: string } | null)?.idToken
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center shadow-sm">
        <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-4">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold text-foreground">Not authorized</h1>
        <p className="text-sm text-muted-foreground mt-2">
          You don&rsquo;t have permission to view this page.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button variant="secondary" onClick={() => void signOutFromKeycloak(idToken)}>
            Switch account
          </Button>
          <a
            href={
              process.env.NEXT_PUBLIC_AFROTRANSACT_URL ?? "https://afrotransact.com"
            }
            className="text-sm text-muted-foreground hover:text-foreground underline"
          >
            Back to AfroTransact
          </a>
        </div>
      </div>
    </div>
  )
}
