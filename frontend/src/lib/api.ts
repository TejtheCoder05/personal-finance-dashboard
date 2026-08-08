import type {
  AnomalyTransaction,
  CategorySpending,
  MerchantSpending,
  MonthlySpending,
  SpendingSummary,
  Transaction,
  AmountSign,
  CsvColumnMapping,
  CsvValidationResult,
  ImportResult,
} from "@/types/finance";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

async function fetchApi<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`);

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as {
      detail?: string;
    } | null;
    throw new Error(errorBody?.detail ?? `API request failed: ${response.status}`);
  }

  return response.json();
}

function withDataset(endpoint: string, datasetId?: string): string {
  if (!datasetId) {
    return endpoint;
  }

  const separator = endpoint.includes("?") ? "&" : "?";
  return `${endpoint}${separator}dataset_id=${encodeURIComponent(datasetId)}`;
}

export function getSpendingSummary(datasetId?: string): Promise<SpendingSummary> {
  return fetchApi<SpendingSummary>(withDataset("/api/summary", datasetId));
}

export function getMonthlySpending(datasetId?: string): Promise<MonthlySpending[]> {
  return fetchApi<MonthlySpending[]>(withDataset("/api/monthly", datasetId));
}

export function getCategorySpending(datasetId?: string): Promise<CategorySpending[]> {
  return fetchApi<CategorySpending[]>(withDataset("/api/categories", datasetId));
}

export function getMerchantSpending(datasetId?: string): Promise<MerchantSpending[]> {
  return fetchApi<MerchantSpending[]>(withDataset("/api/merchants", datasetId));
}

export function getAnomalies(datasetId?: string): Promise<AnomalyTransaction[]> {
  return fetchApi<AnomalyTransaction[]>(withDataset("/api/anomalies", datasetId));
}

interface TransactionFilters {
  limit?: number;
  category?: string;
  anomaliesOnly?: boolean;
  datasetId?: string;
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

  if (filters.datasetId) {
    params.set("dataset_id", filters.datasetId);
  }

  const queryString = params.toString();

  const endpoint = queryString
    ? `/api/transactions?${queryString}`
    : "/api/transactions";

  return fetchApi<Transaction[]>(endpoint);
}

export async function importTransactions(
  file: File,
  amountSign: AmountSign,
  mapping?: CsvColumnMapping,
): Promise<ImportResult> {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("amount_sign", amountSign);
  if (mapping) {
    formData.set("date_column", mapping.date);
    formData.set("description_column", mapping.description);
    formData.set("amount_column", mapping.amount);
  }

  const response = await fetch(`${API_BASE_URL}/api/imports`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as {
      detail?: string;
    } | null;
    throw new Error(errorBody?.detail ?? `Upload failed: ${response.status}`);
  }

  return response.json();
}

export async function validateTransactionCsv(
  file: File,
): Promise<CsvValidationResult> {
  const formData = new FormData();
  formData.set("file", file);

  const response = await fetch(`${API_BASE_URL}/api/imports/validate`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as {
      detail?: string;
    } | null;
    throw new Error(errorBody?.detail ?? `Validation failed: ${response.status}`);
  }

  return response.json();
}

export async function deleteImportedDataset(datasetId: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/imports/${encodeURIComponent(datasetId)}`,
    { method: "DELETE" },
  );

  if (!response.ok && response.status !== 404) {
    throw new Error(`Could not remove uploaded data: ${response.status}`);
  }
}
