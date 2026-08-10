"use client";

import { useEffect, useState } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { getCategorySpending } from "@/lib/api";
import type { CategorySpending } from "@/types/finance";
import { useDataSource } from "@/components/DataSourceProvider";
import { getCategoryColor } from "@/lib/categoryColors";
import { useReducedMotion } from "@/lib/useReducedMotion";
import {
  EmptyState,
  ErrorState,
  LoadingRegion,
  Skeleton,
} from "@/components/ui/States";
import { IconAnalytics } from "@/components/ui/Icons";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

export default function CategorySpendingChart() {
  const { dataset } = useDataSource();
  const reducedMotion = useReducedMotion();
  const [data, setData] = useState<CategorySpending[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCategorySpending() {
      try {
        setLoading(true);
        setError(null);

        const categoryData = await getCategorySpending(dataset?.dataset_id);
        setData(categoryData);
      } catch (err) {
        console.error(err);
        setError("Unable to load category spending data.");
      } finally {
        setLoading(false);
      }
    }

    loadCategorySpending();
  }, [dataset?.dataset_id]);

  if (loading) {
    return (
      <LoadingRegion label="Loading category breakdown" className="space-y-5">
        <Skeleton className="mx-auto h-40 w-40 rounded-full" />

        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-4 w-full" />
          ))}
        </div>
      </LoadingRegion>
    );
  }

  if (error) {
    return <ErrorState title="Could not load categories" message={error} />;
  }

  if (data.length === 0) {
    return (
      <EmptyState
        title="No categorised spending"
        message="Import transactions to see the ML category breakdown."
        icon={<IconAnalytics size={18} />}
        className="h-[17.5rem]"
      />
    );
  }

  const totalSpending = data.reduce(
    (total, category) => total + category.total_spending,
    0,
  );

  return (
    <figure className="m-0">
      <figcaption className="sr-only">
        Spending by category, totalling{" "}
        {currencyFormatter.format(totalSpending)}.{" "}
        {data
          .map(
            (category) =>
              `${category.category}: ${currencyFormatter.format(
                category.total_spending,
              )}, ${category.spending_percentage.toFixed(1)} percent`,
          )
          .join(". ")}
      </figcaption>

      <div className="relative h-44 w-full" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="total_spending"
              nameKey="category"
              cx="50%"
              cy="50%"
              innerRadius={56}
              outerRadius={80}
              paddingAngle={2}
              stroke="#17141b"
              strokeWidth={3}
              isAnimationActive={!reducedMotion}
            >
              {data.map((category) => (
                <Cell
                  key={category.category}
                  fill={getCategoryColor(category.category).hex}
                />
              ))}
            </Pie>

            <Tooltip
              formatter={(value, _name, item) => {
                const category = item.payload as CategorySpending;

                return [
                  `${currencyFormatter.format(
                    Number(value),
                  )} (${category.spending_percentage.toFixed(1)}%)`,
                  category.category,
                ];
              }}
              contentStyle={{
                borderRadius: "0.5rem",
                border: "1px solid #372f3c",
                background: "#1e1a23",
                boxShadow: "0 16px 32px -8px rgb(0 0 0 / 0.7)",
                padding: "0.5rem 0.75rem",
                fontSize: "0.8125rem",
              }}
              labelStyle={{ display: "none" }}
              itemStyle={{ color: "#f4f1f7" }}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-ink-3">
              Total
            </p>

            <p className="numeric mt-1 text-lg font-semibold tracking-tight text-ink">
              {compactCurrencyFormatter.format(totalSpending)}
            </p>
          </div>
        </div>
      </div>

      {/*
        The legend doubles as the value table, so exact figures are never
        hover-only.
      */}
      <dl className="mt-5 space-y-2.5 border-t border-hairline pt-4">
        {data.map((category) => (
          <div
            key={category.category}
            className="flex items-center justify-between gap-3"
          >
            <dt className="flex min-w-0 items-center gap-2.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{
                  backgroundColor: getCategoryColor(category.category).hex,
                }}
              />

              <span className="truncate text-sm text-ink-2">
                {category.category}
              </span>
            </dt>

            <dd className="numeric flex shrink-0 items-baseline gap-2 text-right">
              <span className="text-sm font-semibold text-ink">
                {compactCurrencyFormatter.format(category.total_spending)}
              </span>

              <span className="w-10 text-xs text-ink-3">
                {category.spending_percentage.toFixed(1)}%
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </figure>
  );
}
