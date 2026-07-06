"use client"

import { useMemo } from "react"
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { Movement } from "@/lib/api"

/**
 * 7-day stock-movement volume chart. Bucketed by calendar day; absolute
 * delta magnitude (in + out separately) shown as two layered areas so an
 * operator can see throughput at a glance without parsing tables.
 */
export function MovementsSparkline({ movements }: { movements: Movement[] }) {
  const data = useMemo(() => {
    const days: { day: string; in: number; out: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000)
      days.push({
        day: d.toLocaleDateString("en-US", { weekday: "short" }),
        in: 0,
        out: 0,
      })
    }
    for (const m of movements) {
      const created = new Date(m.created_at)
      const dayLabel = created.toLocaleDateString("en-US", { weekday: "short" })
      const bucket = days.find((d) => d.day === dayLabel)
      if (!bucket) continue
      if (m.delta > 0) bucket.in += m.delta
      else bucket.out += Math.abs(m.delta)
    }
    return days
  }, [movements])

  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id="g-in" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#10b981" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="g-out" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#737373" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "#737373" }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "#f5f5f5" }}
            contentStyle={{ borderRadius: 8, border: "1px solid #e5e5e5", fontSize: 12, padding: "6px 10px" }}
            formatter={(v, n) => [v as number, n === "in" ? "In" : "Out"] as [number, string]}
          />
          <Area type="monotone" dataKey="in"  stroke="#10b981" fill="url(#g-in)"  strokeWidth={2} />
          <Area type="monotone" dataKey="out" stroke="#f59e0b" fill="url(#g-out)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
