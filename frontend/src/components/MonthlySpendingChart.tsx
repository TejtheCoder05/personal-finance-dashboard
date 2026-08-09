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
import { useReducedMotion } from "@/lib/useReducedMotion";
import {
  EmptyState,
  ErrorState,
  LoadingRegion,
  Skeleton,
} from "@/components/ui/States";
import { IconAnalytics } from "@/components/ui/Icons";

const LINE = "#047857";
const CHART_HEIGHT = "h-[17.5rem]";

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

/** Only switches to compact "k" notation once the scale actually warrants it. */
function formatAxisAmount(value: number) {
  if (Math.abs(value) >= 1000) {
    const thousands = value / 1000;
    return `$${thousands.toFixed(Number.isInteger(thousands) ? 0 : 1)}k`;
  }

  return `$${Math.round(value)}`;
}

export default function MonthlySpendingChart() {
  const { dataset } = useDataSource();
  const reducedMotion = useReducedMotion();
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
      <LoadingRegion
        label="Loading monthly spending"
        className={`${CHART_HEIGHT} w-full`}
      >
        <div className="flex h-full flex-col justify-end gap-3 rounded-lg bg-surface-2 p-5">
          <Skeleton className="h-3 w-28 bg-surface-3" />
          <Skeleton className="h-full w-full rounded-md" />
        </div>
      </LoadingRegion>
    );
  }

  if (error) {
    return <ErrorState title="Could not load chart" message={error} />;
  }

  if (data.length === 0) {
    return (
      <EmptyState
        title="No monthly spending yet"
        message="Once transactions span a full month, the trend will appear here."
        icon={<IconAnalytics size={18} />}
        className={CHART_HEIGHT}
      />
    );
  }

  const total = data.reduce((sum, month) => sum + month.total_spending, 0);

  return (
    <figure className="m-0">
      {/* Screen-reader equivalent of the plotted series. */}
      <figcaption className="sr-only">
        Monthly spending trend across {data.length} months, totalling{" "}
        {currencyFormatter.format(total)}.{" "}
        {data
          .map(
            (month) =>
              `${formatMonth(month.month)}: ${currencyFormatter.format(
                month.total_spending,
              )}`,
          )
          .join(". ")}
      </figcaption>

      <div className={`${CHART_HEIGHT} w-full`} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{
              top: 8,
              right: 8,
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
                <stop offset="0%" stopColor={LINE} stopOpacity={0.16} />
                <stop offset="100%" stopColor={LINE} stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="4 4"
              vertical={false}
              stroke="#e3e8ef"
            />

            <XAxis
              dataKey="month"
              tickFormatter={formatMonth}
              axisLine={false}
              tickLine={false}
              tick={{
                fill: "#5f6f86",
                fontSize: 12,
              }}
              dy={10}
              minTickGap={8}
            />

            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{
                fill: "#5f6f86",
                fontSize: 12,
              }}
              tickFormatter={formatAxisAmount}
              width={56}
            />

            <Tooltip
              cursor={{ stroke: "#cbd5e1", strokeWidth: 1 }}
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
                borderRadius: "0.5rem",
                border: "1px solid #e3e8ef",
                boxShadow: "0 12px 20px -6px rgb(15 23 42 / 0.12)",
                padding: "0.5rem 0.75rem",
                fontSize: "0.8125rem",
              }}
              labelStyle={{
                color: "#475569",
                fontWeight: 500,
                marginBottom: "0.25rem",
              }}
              itemStyle={{ color: "#0f172a", fontWeight: 600 }}
            />

            <Area
              type="monotone"
              dataKey="total_spending"
              stroke={LINE}
              strokeWidth={2}
              fill="url(#spendingGradient)"
              isAnimationActive={!reducedMotion}
              activeDot={{
                r: 4,
                strokeWidth: 2,
                stroke: "#ffffff",
                fill: LINE,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
