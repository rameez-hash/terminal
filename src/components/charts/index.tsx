"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"];

interface ChartProps {
  data: Array<Record<string, string | number>>;
  dataKey?: string;
  xKey?: string;
  height?: number;
}

export function RevenueLineChart({ data, dataKey = "revenue", xKey = "month", height = 300 }: ChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
        <XAxis dataKey={xKey} className="text-xs" tick={{ fill: "#64748b" }} />
        <YAxis className="text-xs" tick={{ fill: "#64748b" }} />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--background)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
          }}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke="#6366f1"
          strokeWidth={2}
          dot={{ fill: "#6366f1" }}
          name="Revenue"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function RevenueBarChart({ data, dataKey = "revenue", xKey = "name", height = 300 }: ChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
        <XAxis dataKey={xKey} className="text-xs" tick={{ fill: "#64748b" }} />
        <YAxis className="text-xs" tick={{ fill: "#64748b" }} />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--background)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
          }}
        />
        <Bar dataKey={dataKey} fill="#6366f1" radius={[4, 4, 0, 0]} name="Revenue" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ProviderPieChart({ data, height = 300 }: ChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="revenue"
          nameKey="provider"
          cx="50%"
          cy="50%"
          outerRadius={100}
          label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function TargetProgressChart({
  achieved,
  target,
  height = 200,
}: {
  achieved: number;
  target: number;
  height?: number;
}) {
  const remaining = Math.max(0, target - achieved);
  const data = [
    { name: "Achieved", value: achieved },
    { name: "Remaining", value: remaining },
  ];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={80}
          startAngle={90}
          endAngle={-270}
        >
          <Cell fill="#6366f1" />
          <Cell fill="#e2e8f0" />
        </Pie>
        <Tooltip formatter={(value) => [`$${Number(value ?? 0).toLocaleString()}`, ""]} />
      </PieChart>
    </ResponsiveContainer>
  );
}
