import type { SavingsGoal } from "@/types/finance";

const STORAGE_KEY = "financeiq:savings-goals:v1";
const CHANGE_EVENT = "financeiq:savings-goals-change";
const EMPTY_GOALS: SavingsGoal[] = [];
let cachedValue: string | null | undefined;
let cachedGoals: SavingsGoal[] = EMPTY_GOALS;

function isSavingsGoal(value: unknown): value is SavingsGoal {
  if (!value || typeof value !== "object") {
    return false;
  }

  const goal = value as Partial<SavingsGoal>;
  return (
    typeof goal.id === "string" &&
    typeof goal.name === "string" &&
    typeof goal.targetAmount === "number" &&
    goal.targetAmount > 0 &&
    typeof goal.currentAmount === "number" &&
    goal.currentAmount >= 0 &&
    (goal.targetDate === null || typeof goal.targetDate === "string")
  );
}

export function loadSavingsGoals(): SavingsGoal[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === cachedValue) {
      return cachedGoals;
    }
    cachedValue = stored;
    if (!stored) {
      cachedGoals = EMPTY_GOALS;
      return cachedGoals;
    }
    const parsed: unknown = JSON.parse(stored);
    cachedGoals = Array.isArray(parsed) ? parsed.filter(isSavingsGoal) : EMPTY_GOALS;
    return cachedGoals;
  } catch {
    return EMPTY_GOALS;
  }
}

export function saveSavingsGoals(goals: SavingsGoal[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeToSavingsGoals(onStoreChange: () => void): () => void {
  function handleStorage(event: StorageEvent) {
    if (event.key === STORAGE_KEY) {
      onStoreChange();
    }
  }

  window.addEventListener("storage", handleStorage);
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
  };
}

export function getServerSavingsGoals(): SavingsGoal[] {
  return EMPTY_GOALS;
}
