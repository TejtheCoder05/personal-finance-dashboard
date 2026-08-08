export interface SpendingSummary {
  transaction_count: number;
  total_spending: number;
  average_transaction: number;
  median_transaction: number;
  largest_transaction: number;
  anomaly_count: number;
  anomaly_rate: number;
  anomalous_spending: number;
}

export interface MonthlySpending {
  month: string;
  total_spending: number;
  transaction_count: number;
  average_transaction: number;
  anomaly_count: number;
  month_over_month_change: number | null;
}

export interface CategorySpending {
  category: string;
  total_spending: number;
  transaction_count: number;
  average_transaction: number;
  anomaly_count: number;
  spending_percentage: number;
}

export interface MerchantSpending {
  merchant: string;
  total_spending: number;
  transaction_count: number;
  average_transaction: number;
  largest_transaction: number;
  anomaly_count: number;
}

export interface AnomalyTransaction {
  date: string;
  merchant: string;
  category: string;
  amount: number;
  anomaly_score: number;
  merchant_median_amount: number;
  merchant_amount_ratio: number;
  anomaly_reason: string;
}

export interface Transaction {
  date: string;
  description_raw: string;
  amount: number;
  merchant: string;
  category: string;
  category_confidence: number;
  is_anomaly_candidate: boolean;
  is_anomaly: boolean;
  anomaly_score: number;
  anomaly_reason: string | null;
}

export type AmountSign = "purchase_positive" | "purchase_negative";

export interface CsvColumnMapping {
  date: string;
  description: string;
  amount: string;
}

export interface CsvValidationResult {
  filename: string;
  columns: string[];
  row_count: number;
  suggested_mapping: {
    date: string | null;
    description: string | null;
    amount: string | null;
  };
  preview: Record<string, string | number | boolean | null>[];
  warnings: string[];
}

export interface ImportResult {
  dataset_id: string;
  filename: string;
  transaction_count: number;
  column_mapping: CsvColumnMapping;
  storage: "temporary";
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string | null;
}
