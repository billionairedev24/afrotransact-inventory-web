"use client"

import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { AppShell, PageHeader } from "@/components/layout/AppShell"
import { Card, CardBody, CardHeader } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { FieldLabel, Input, Textarea } from "@/components/ui/Input"
import { useCreateCycleCount, useStock } from "@/lib/queries"

export default function NewCycleCountPage() {
  const router = useRouter()
  const create = useCreateCycleCount()
  const stock = useStock()
  const defaultLocation = stock.data?.[0]?.location_id ?? ""
  const [locationId, setLocationId] = useState("")
  const [notes, setNotes] = useState("")
  if (!locationId && defaultLocation) setLocationId(defaultLocation)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const c = await create.mutateAsync({
      location_id: locationId,
      notes: notes.trim() || undefined,
    })
    router.push(`/cycle-counts/${c.id}`)
  }

  return (
    <AppShell>
      <Link
        href="/cycle-counts"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3"
      >
        <ChevronLeft className="h-4 w-4" /> Cycle counts
      </Link>
      <PageHeader
        title="New cycle count"
        subtitle="Snapshots every SKU at the location with current expected on-hand."
      />

      <Card className="max-w-xl">
        <CardHeader>
          <h2 className="text-base font-semibold text-foreground">Scope</h2>
        </CardHeader>
        <CardBody>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <FieldLabel htmlFor="loc">Location</FieldLabel>
              <Input
                id="loc"
                required
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                placeholder="Location UUID"
                className="font-mono text-xs"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">Auto-filled from the first stock row.</p>
            </div>
            <div>
              <FieldLabel htmlFor="notes">Notes</FieldLabel>
              <Textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="(optional)" />
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" loading={create.isPending}>Open count</Button>
              <Link href="/cycle-counts"><Button type="button" variant="ghost">Cancel</Button></Link>
            </div>
          </form>
        </CardBody>
      </Card>
    </AppShell>
  )
}
