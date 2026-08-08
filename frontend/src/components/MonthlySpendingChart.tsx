"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { getMonthlySpending } from "@/lib/api";
import type { MonthlySpending } from "@/types/finance";
import { useDataSource } from "@/components/DataSourceProvider";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatMonth(month: string) {
  const [year, monthNumber] = month.split("-");

  const date = new Date(
    Number(year),
    Number(monthNumber) - 1,
    1,
  );

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
  }).format(date);
}

export default function MonthlySpendingChart() {
  const { dataset } = useDataSource();
  const [data, setData] = useState<MonthlySpending[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMonthlySpending() {
      try {
        setLoading(true);
        setError(null);

        const monthlyData = await getMonthlySpending(dataset?.dataset_id);
        setData(monthlyData);
      } catch (err) {
        console.error(err);

        setError(
          "Unable to load monthly spending data.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadMonthlySpending();
  }, [dataset?.dataset_id]);

  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center rounded-xl bg-gray-50">
        <div className="w-full space-y-4 px-8">
          <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
          <div className="h-44 w-full animate-pulse rounded-lg bg-gray-100" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-72 items-center justify-center rounded-xl border border-red-200 bg-red-50">
        <div className="text-center">
          <p className="text-sm font-semibold text-red-800">
            Could not load chart
          </p>

          <p className="mt-1 text-xs text-red-600">
            {error}
          </p>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-xl bg-gray-50">
        <p className="text-sm text-gray-500">
          No monthly spending data available.
        </p>
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{
            top: 10,
            right: 10,
            left: 0,
            bottom: 0,
          }}
        >
          <defs>
            <linearGradient
              id="spendingGradient"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="5%"
                stopColor="#10b981"
                stopOpacity={0.25}
              />
              <stop
                offset="95%"
                stopColor="#10b981"
                stopOpacity={0}
              />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="#e5e7eb"
          />

          <XAxis
            dataKey="month"
            tickFormatter={formatMonth}
            axisLine={false}
            tickLine={false}
            tick={{
              fill: "#6b7280",
              fontSize: 12,
            }}
            dy={8}
          />

          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{
              fill: "#6b7280",
              fontSize: 12,
            }}
            tickFormatter={(value: number) =>
              `$${(value / 1000).toFixed(1)}k`
            }
            width={55}
          />

          <Tooltip
            formatter={(value) => [
              currencyFormatter.format(Number(value)),
              "Spending",
            ]}
            labelFormatter={(label) => {
              const monthlyRecord = data.find(
                (item) => item.month === label,
              );

              if (!monthlyRecord) {
                return formatMonth(String(label));
              }

              const monthLabel = formatMonth(monthlyRecord.month);

              return `${monthLabel} • ${monthlyRecord.transaction_count} transactions`;
            }}
            contentStyle={{
              borderRadius: "12px",
              border: "1px solid #e5e7eb",
              boxShadow:
                "0 10px 25px rgba(0, 0, 0, 0.08)",
            }}
          />

          <Area
            type="monotone"
            dataKey="total_spending"
            stroke="#10b981"
            strokeWidth={3}
            fill="url(#spendingGradient)"
            activeDot={{
              r: 5,
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
