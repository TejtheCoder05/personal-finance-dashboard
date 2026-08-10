"use client";

import { useState } from "react";
import AuthControls from "@/components/AuthControls";
import { NAV_ITEMS, NAV_TARGET_IDS } from "@/components/navigation";
import { useActiveSection } from "@/lib/useActiveSection";
import { IconClose, IconMenu } from "@/components/ui/Icons";

export default function MobileHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const active = useActiveSection(NAV_TARGET_IDS);

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-canvas/90 backdrop-blur lg:hidden">
      <div className="flex h-16 items-center justify-between px-4 sm:px-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-sm font-bold text-brand-ink">
            F
          </span>

          <div>
            <p className="text-sm font-semibold tracking-tight text-ink">
              FinanceIQ
            </p>

            <p className="text-[0.6875rem] text-ink-3">
              ML Finance Analytics
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((current) => !current)}
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-surface-2 text-ink-2 transition-colors duration-150 hover:border-hairline-strong hover:text-ink"
        >
          {menuOpen ? <IconClose size={20} /> : <IconMenu size={20} />}
        </button>
      </div>

      {menuOpen && (
        <nav
          id="mobile-nav"
          aria-label="Dashboard sections"
          className="border-t border-hairline bg-surface px-4 pb-4 pt-3 sm:px-5"
        >
          <ul className="space-y-1">
            {NAV_ITEMS.map(({ label, targetId, Icon }) => {
              const isActive = active === targetId;

              return (
                <li key={label}>
                  <a
                    href={`#${targetId}`}
                    aria-current={isActive ? "location" : undefined}
                    onClick={() => setMenuOpen(false)}
                    className={`flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 text-left text-sm transition-colors duration-150 ${
                      isActive
                        ? "border-brand-line bg-brand-soft font-medium text-brand"
                        : "border-transparent font-normal text-ink-2 hover:bg-surface-2 hover:text-ink"
                    }`}
                  >
                    <Icon size={17} className="shrink-0" />
                    {label}
                  </a>
                </li>
              );
            })}
          </ul>

          <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-hairline bg-inset px-3 py-2.5">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-positive"
            />

            <div>
              <p className="text-xs font-medium text-ink">API connected</p>
              <p className="text-[0.6875rem] text-ink-3">
                Categorisation and anomaly models ready
              </p>
            </div>
          </div>

          <div className="mt-3 border-t border-hairline pt-3">
            <AuthControls compact />
          </div>
        </nav>
      )}
    </header>
  );
}
