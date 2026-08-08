"use client";

import { useState } from "react";

const navigation = [
  "Overview",
  "Transactions",
  "Analytics",
  "Anomalies",
];

export default function MobileHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur lg:hidden">
        <div className="flex h-16 items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-sm font-bold text-white">
              F
            </div>

            <div>
              <p className="text-sm font-semibold tracking-tight text-gray-900">
                FinanceIQ
              </p>

              <p className="text-[11px] text-gray-400">
                ML Finance Analytics
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((current) => !current)}
            aria-label="Toggle navigation menu"
            aria-expanded={menuOpen}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50"
          >
            {menuOpen ? (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            ) : (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M4 6h16" />
                <path d="M4 12h16" />
                <path d="M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {menuOpen && (
          <nav className="border-t border-gray-100 bg-white px-4 py-3">
            <div className="space-y-1">
              {navigation.map((item, index) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition ${
                    index === 0
                      ? "bg-emerald-50 text-emerald-700"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      index === 0
                        ? "bg-emerald-500"
                        : "bg-gray-300"
                    }`}
                  />

                  {item}
                </button>
              ))}
            </div>

            <div className="mt-3 flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-3">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />

              <div>
                <p className="text-xs font-medium text-gray-700">
                  API Connected
                </p>

                <p className="text-[11px] text-gray-400">
                  ML pipeline ready
                </p>
              </div>
            </div>
          </nav>
        )}
      </header>
    </>
  );
}