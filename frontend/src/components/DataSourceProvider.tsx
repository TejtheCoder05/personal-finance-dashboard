"use client";

import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "@/components/AuthProvider";
import { getStoredDatasets } from "@/lib/api";
import type { ImportResult } from "@/types/finance";

interface DataSourceContextValue {
  dataset: ImportResult | null;
  restoring: boolean;
  activateDataset: (dataset: ImportResult) => void;
  activateDemo: () => void;
  refreshStoredDataset: () => Promise<void>;
}

interface SessionDataSource {
  /** Account the dataset belongs to; null while signed out. */
  userId: string | null;
  dataset: ImportResult | null;
  /** True once stored datasets have been looked up for this account. */
  restored: boolean;
}

const DataSourceContext = createContext<DataSourceContextValue | null>(null);

export function DataSourceProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const [session, setSession] = useState<SessionDataSource>({
    userId: null,
    dataset: null,
    restored: true,
  });

  // Derived rather than stored, so a session change can never leave the
  // previous account's data on screen.
  const current: SessionDataSource =
    session.userId === userId
      ? session
      : { userId, dataset: null, restored: !userId };

  const refreshStoredDataset = useCallback(async () => {
    const datasets = await getStoredDatasets();
    setSession({
      userId,
      dataset: datasets.find((stored) => stored.is_active) ?? null,
      restored: true,
    });
  }, [userId]);

  useEffect(() => {
    if (authLoading || !userId) {
      return;
    }

    let active = true;
    getStoredDatasets()
      .then((datasets) => {
        if (active) {
          setSession({
            userId,
            dataset: datasets.find((stored) => stored.is_active) ?? null,
            restored: true,
          });
        }
      })
      .catch(() => {
        // Leave the dashboard on the demo dataset if the lookup fails.
        if (active) {
          setSession({ userId, dataset: null, restored: true });
        }
      });

    return () => {
      active = false;
    };
  }, [authLoading, userId]);

  const value = useMemo<DataSourceContextValue>(
    () => ({
      dataset: current.dataset,
      restoring: !authLoading && Boolean(userId) && !current.restored,
      activateDataset: (dataset) =>
        setSession({ userId, dataset, restored: true }),
      activateDemo: () => setSession({ userId, dataset: null, restored: true }),
      refreshStoredDataset,
    }),
    [authLoading, current.dataset, current.restored, refreshStoredDataset, userId],
  );

  return (
    <DataSourceContext.Provider value={value}>
      {/* Remounting on sign-in/sign-out forces every panel to refetch. */}
      <Fragment key={userId ?? "anonymous"}>{children}</Fragment>
    </DataSourceContext.Provider>
  );
}

export function useDataSource(): DataSourceContextValue {
  const context = useContext(DataSourceContext);
  if (!context) {
    throw new Error("useDataSource must be used within DataSourceProvider.");
  }
  return context;
}
