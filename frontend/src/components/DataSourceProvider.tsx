"use client";

import { createContext, useContext, useMemo, useState } from "react";

import type { ImportResult } from "@/types/finance";

interface DataSourceContextValue {
  dataset: ImportResult | null;
  activateDataset: (dataset: ImportResult) => void;
  activateDemo: () => void;
}

const DataSourceContext = createContext<DataSourceContextValue | null>(null);

export function DataSourceProvider({ children }: { children: React.ReactNode }) {
  const [dataset, setDataset] = useState<ImportResult | null>(null);

  const value = useMemo(
    () => ({
      dataset,
      activateDataset: setDataset,
      activateDemo: () => setDataset(null),
    }),
    [dataset],
  );

  return (
    <DataSourceContext.Provider value={value}>
      {children}
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
