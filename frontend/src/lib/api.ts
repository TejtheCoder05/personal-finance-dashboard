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
  AuthUser,
  PersistentSavingsGoal,
  SavingsGoalPayload,
  StoredDataset,
} from "@/types/finance";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

async function responseError(response: Response, fallback: string): Promise<ApiError> {
  const errorBody = (await response.json().catch(() => null)) as {
    detail?: unknown;
  } | null;
  const detail = typeof errorBody?.detail === "string" ? errorBody.detail : fallback;
  return new ApiError(detail, response.status);
}

async function fetchApi<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw await responseError(response, `API request failed: ${response.status}`);
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
    credentials: "include",
  });

  if (!response.ok) {
    throw await responseError(response, `Upload failed: ${response.status}`);
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
    credentials: "include",
  });

  if (!response.ok) {
    throw await responseError(response, `Validation failed: ${response.status}`);
  }

  return response.json();
}

export function getStoredDatasets(): Promise<StoredDataset[]> {
  return fetchApi<StoredDataset[]>("/api/imports");
}

export async function deleteImportedDataset(datasetId: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/imports/${encodeURIComponent(datasetId)}`,
    { method: "DELETE", credentials: "include" },
  );

  if (!response.ok && response.status !== 404) {
    throw new Error(`Could not remove uploaded data: ${response.status}`);
  }
}

export async function registerUser(email: string, password: string): Promise<AuthUser> {
  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw await responseError(response, "Could not create your account.");
  }
  return response.json();
}

export async function loginUser(email: string, password: string): Promise<void> {
  const formData = new URLSearchParams({ username: email, password });
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    credentials: "include",
    body: formData,
  });
  if (!response.ok) {
    throw await responseError(response, "Incorrect email or password.");
  }
}

export function getCurrentUser(): Promise<AuthUser> {
  return fetchApi<AuthUser>("/api/auth/me");
}

export async function logoutUser(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) {
    throw await responseError(response, "Could not log out.");
  }
}

export function getSavingsGoals(): Promise<PersistentSavingsGoal[]> {
  return fetchApi<PersistentSavingsGoal[]>("/api/goals");
}

export async function createSavingsGoal(
  goal: SavingsGoalPayload,
): Promise<PersistentSavingsGoal> {
  const response = await fetch(`${API_BASE_URL}/api/goals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(goal),
  });
  if (!response.ok) {
    throw await responseError(response, "Could not create the savings goal.");
  }
  return response.json();
}

export async function updateSavingsGoal(
  goalId: string,
  goal: SavingsGoalPayload,
): Promise<PersistentSavingsGoal> {
  const response = await fetch(
    `${API_BASE_URL}/api/goals/${encodeURIComponent(goalId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(goal),
    },
  );
  if (!response.ok) {
    throw await responseError(response, "Could not update the savings goal.");
  }
  return response.json();
}

export async function deleteSavingsGoal(goalId: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/goals/${encodeURIComponent(goalId)}`,
    { method: "DELETE", credentials: "include" },
  );
  if (!response.ok) {
    throw await responseError(response, "Could not delete the savings goal.");
  }
}
