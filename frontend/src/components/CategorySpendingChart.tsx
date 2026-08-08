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

const COLORS = [
  "#10b981",
  "#3b82f6",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
];

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
      <div className="space-y-4">
        <div className="mx-auto h-44 w-44 animate-pulse rounded-full bg-gray-100" />

        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-5 w-full animate-pulse rounded bg-gray-100"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-72 items-center justify-center rounded-xl border border-red-200 bg-red-50">
        <div className="text-center">
          <p className="text-sm font-semibold text-red-800">
            Could not load categories
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
          No category spending data available.
        </p>
      </div>
    );
  }

  const totalSpending = data.reduce(
    (total, category) => total + category.total_spending,
    0,
  );

  return (
    <div>
      <div className="relative h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="total_spending"
              nameKey="category"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={78}
              paddingAngle={3}
              stroke="none"
            >
              {data.map((category, index) => (
                <Cell
                  key={category.category}
                  fill={COLORS[index % COLORS.length]}
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
                borderRadius: "12px",
                border: "1px solid #e5e7eb",
                boxShadow: "0 10px 25px rgba(0, 0, 0, 0.08)",
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-xs font-medium text-gray-400">
              Total
            </p>

            <p className="mt-1 text-lg font-semibold tracking-tight text-gray-900">
              {compactCurrencyFormatter.format(totalSpending)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        {data.map((category, index) => (
          <div
            key={category.category}
            className="flex items-center justify-between gap-3"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{
                  backgroundColor: COLORS[index % COLORS.length],
                }}
              />

              <span className="truncate text-sm font-medium text-gray-600">
                {category.category}
              </span>
            </div>

            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900">
                {compactCurrencyFormatter.format(
                  category.total_spending,
                )}
              </p>

              <p className="text-xs text-gray-400">
                {category.spending_percentage.toFixed(1)}%
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
