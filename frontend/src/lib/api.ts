import type {
  AnomalyTransaction,
  CategorySpending,
  MerchantSpending,
  MonthlySpending,
  SpendingSummary,
  Transaction,
} from "@/types/finance";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

async function fetchApi<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`);

  if (!response.ok) {
    throw new Error(
      `API request failed: ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
}

export function getSpendingSummary(): Promise<SpendingSummary> {
  return fetchApi<SpendingSummary>("/api/summary");
}

export function getMonthlySpending(): Promise<MonthlySpending[]> {
  return fetchApi<MonthlySpending[]>("/api/monthly");
}

export function getCategorySpending(): Promise<CategorySpending[]> {
  return fetchApi<CategorySpending[]>("/api/categories");
}

export function getMerchantSpending(): Promise<MerchantSpending[]> {
  return fetchApi<MerchantSpending[]>("/api/merchants");
}

export function getAnomalies(): Promise<AnomalyTransaction[]> {
  return fetchApi<AnomalyTransaction[]>("/api/anomalies");
}

interface TransactionFilters {
  limit?: number;
  category?: string;
  anomaliesOnly?: boolean;
}

export function getTransactions(
  filters: TransactionFilters = {},
): Promise<Transaction[]> {
  const params = new URLSearchParams();

  if (filters.limit) {
    params.set("limit", filters.limit.toString());
  }

  if (filters.category) {
    params.set("category", filters.category);
  }

  if (filters.anomaliesOnly) {
    params.set("anomalies_only", "true");
  }

  const queryString = params.toString();

  const endpoint = queryString
    ? `/api/transactions?${queryString}`
    : "/api/transactions";

  return fetchApi<Transaction[]>(endpoint);
}