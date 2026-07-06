"use client"

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

/**
 * Three lightweight chart wrappers used by Reports tabs. Wrapping them
 * here keeps the recharts surface small at each call site and makes
 * future theming (one place to swap colours) trivial.
 */

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ef4444", "#0ea5e9", "#84cc16"]

export function MovementsAreaChart({
  data,
  height = 240,
}: {
  data: { day: string; in: number; out: number }[]
  height?: number
}) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id="grad-in" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#10b981" stopOpacity={0.45} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="grad-out" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.45} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#737373" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#737373" }} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "#f5f5f5" }}
            contentStyle={{ borderRadius: 8, border: "1px solid #e5e5e5", fontSize: 12, padding: "6px 10px" }}
          />
          <Area type="monotone" dataKey="in"  stroke="#10b981" fill="url(#grad-in)"  strokeWidth={2} />
          <Area type="monotone" dataKey="out" stroke="#f59e0b" fill="url(#grad-out)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ValuationByLocationChart({
  data,
  height = 240,
}: {
  data: { name: string; value: number }[]
  height?: number
}) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={45} outerRadius={90} paddingAngle={1}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ borderRadius: 8, border: "1px solid #e5e5e5", fontSize: 12, padding: "6px 10px" }}
            formatter={(v) => [`$${(Number(v) / 100).toLocaleString()}`, "Value"] as [string, string]}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

export function MovementsByReasonChart({
  data,
  height = 240,
}: {
  data: { reason: string; count: number }[]
  height?: number
}) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
          <XAxis dataKey="reason" tick={{ fontSize: 11, fill: "#737373" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#737373" }} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "#f5f5f5" }}
            contentStyle={{ borderRadius: 8, border: "1px solid #e5e5e5", fontSize: 12, padding: "6px 10px" }}
          />
          <Bar dataKey="count" radius={[6, 6, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
