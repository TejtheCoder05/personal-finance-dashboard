"use client";

import { useEffect, useState } from "react";

import { getTransactions } from "@/lib/api";
import type { Transaction } from "@/types/finance";
import { useDataSource } from "@/components/DataSourceProvider";

const categories = [
  "All",
  "Dining",
  "Groceries",
  "Entertainment",
  "Fuel",
  "Shopping",
];

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatMerchantName(merchant: string) {
  return merchant
    .split(" ")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}

function formatDate(date: string) {
  const parsedDate = new Date(date);

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsedDate);
}

function getCategoryStyle(category: string) {
  switch (category) {
    case "Dining":
      return "bg-violet-50 text-violet-700";

    case "Groceries":
      return "bg-emerald-50 text-emerald-700";

    case "Entertainment":
      return "bg-pink-50 text-pink-700";

    case "Fuel":
      return "bg-amber-50 text-amber-700";

    case "Shopping":
      return "bg-blue-50 text-blue-700";

    default:
      return "bg-gray-100 text-gray-600";
  }
}

export default function RecentTransactions() {
  const { dataset } = useDataSource();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [category, setCategory] = useState("All");
  const [anomaliesOnly, setAnomaliesOnly] = useState(false);
  const [limit, setLimit] = useState(10);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTransactions() {
      try {
        setLoading(true);
        setError(null);

        const data = await getTransactions({
          limit,
          category: category === "All" ? undefined : category,
          anomaliesOnly,
          datasetId: dataset?.dataset_id,
        });

        setTransactions(data);
      } catch (err) {
        console.error(err);
        setError("Unable to load transaction data.");
      } finally {
        setLoading(false);
      }
    }

    loadTransactions();
  }, [category, anomaliesOnly, limit, dataset?.dataset_id]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">
            Recent Transactions
          </h3>

          <p className="mt-1 text-sm text-gray-500">
            Latest categorized transaction activity
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center">
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 sm:w-auto"
          >
            {categories.map((categoryOption) => (
              <option
                key={categoryOption}
                value={categoryOption}
              >
                {categoryOption === "All"
                  ? "All categories"
                  : categoryOption}
              </option>
            ))}
          </select>

          <select
            value={limit}
            onChange={(event) =>
              setLimit(Number(event.target.value))
            }
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 sm:w-auto"
          >
            <option value={10}>10 rows</option>
            <option value={25}>25 rows</option>
            <option value={50}>50 rows</option>
          </select>

          <button
            type="button"
            onClick={() => setAnomaliesOnly((current) => !current)}
            className={`col-span-2 w-full rounded-lg border px-3 py-2 text-sm font-medium transition sm:w-auto ${
              anomaliesOnly
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {anomaliesOnly
              ? "✓ Anomalies only"
              : "Anomalies only"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="rounded-xl border border-gray-100 p-4"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 animate-pulse rounded-lg bg-gray-100" />

                <div className="flex-1">
                  <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
                  <div className="mt-2 h-3 w-24 animate-pulse rounded bg-gray-100" />
                </div>

                <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm font-semibold text-red-800">
            Could not load transactions
          </p>

          <p className="mt-1 text-xs text-red-600">
            {error}
          </p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-10 text-center">
          <p className="text-sm font-medium text-gray-700">
            No transactions found
          </p>

          <p className="mt-1 text-xs text-gray-400">
            Try changing the selected filters.
          </p>
        </div>
      ) : (
        <>
          {/* Mobile transaction cards */}
          <div className="space-y-3 md:hidden">
            {transactions.map((transaction, index) => (
              <div
                key={`${transaction.date}-${transaction.merchant}-${transaction.amount}-${index}`}
                className={`rounded-xl border p-4 ${
                  transaction.is_anomaly
                    ? "border-amber-200 bg-amber-50/40"
                    : "border-gray-200 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${
                        transaction.is_anomaly
                          ? "bg-amber-100 text-amber-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {transaction.merchant
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {formatMerchantName(transaction.merchant)}
                      </p>

                      <p className="mt-0.5 truncate text-xs text-gray-400">
                        {transaction.description_raw}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-gray-900">
                      {currencyFormatter.format(transaction.amount)}
                    </p>

                    {transaction.is_anomaly && (
                      <p className="mt-1 text-xs font-medium text-red-600">
                        Score {transaction.anomaly_score.toFixed(1)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getCategoryStyle(
                      transaction.category,
                    )}`}
                  >
                    {transaction.category}
                  </span>

                  {transaction.is_anomaly && (
                    <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                      Anomaly
                    </span>
                  )}

                  <span className="text-xs text-gray-400">
                    {formatDate(transaction.date)}
                  </span>
                </div>

                <div className="mt-4 border-t border-gray-100 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">
                      Category confidence
                    </span>

                    <span className="text-xs font-medium text-gray-600">
                      {(transaction.category_confidence * 100).toFixed(0)}%
                    </span>
                  </div>

                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{
                        width: `${Math.min(
                          transaction.category_confidence * 100,
                          100,
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop transaction table */}
          <div className="hidden overflow-x-auto rounded-xl border border-gray-200 md:block">
            <table className="w-full min-w-[850px] border-collapse">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                    Merchant
                  </th>

                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                    Category
                  </th>

                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                    Date
                  </th>

                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                    Confidence
                  </th>

                  <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                    Amount
                  </th>
                </tr>
              </thead>

              <tbody>
                {transactions.map((transaction, index) => (
                  <tr
                    key={`${transaction.date}-${transaction.merchant}-${transaction.amount}-${index}`}
                    className={`border-t border-gray-100 transition hover:bg-gray-50 ${
                      transaction.is_anomaly
                        ? "bg-amber-50/40"
                        : "bg-white"
                    }`}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${
                            transaction.is_anomaly
                              ? "bg-amber-100 text-amber-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {transaction.merchant
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900">
                              {formatMerchantName(
                                transaction.merchant,
                              )}
                            </p>

                            {transaction.is_anomaly && (
                              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                                Anomaly
                              </span>
                            )}
                          </div>

                          <p className="mt-0.5 max-w-[260px] truncate text-xs text-gray-400">
                            {transaction.description_raw}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getCategoryStyle(
                          transaction.category,
                        )}`}
                      >
                        {transaction.category}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-500">
                      {formatDate(transaction.date)}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{
                              width: `${Math.min(
                                transaction.category_confidence * 100,
                                100,
                              )}%`,
                            }}
                          />
                        </div>

                        <span className="text-xs text-gray-500">
                          {(
                            transaction.category_confidence *
                            100
                          ).toFixed(0)}
                          %
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-right">
                      <p className="text-sm font-semibold text-gray-900">
                        {currencyFormatter.format(
                          transaction.amount,
                        )}
                      </p>

                      {transaction.is_anomaly && (
                        <p className="mt-0.5 text-xs font-medium text-red-600">
                          Score{" "}
                          {transaction.anomaly_score.toFixed(1)}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-col gap-2 text-xs text-gray-400 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Showing {transactions.length} transaction
              {transactions.length === 1 ? "" : "s"}
            </p>

            <p>
              {category === "All"
                ? "All categories"
                : category}
              {anomaliesOnly ? " • Anomalies only" : ""}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
