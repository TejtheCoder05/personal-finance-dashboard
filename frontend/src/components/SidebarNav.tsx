"use client";

import { NAV_ITEMS, NAV_TARGET_IDS } from "@/components/navigation";
import { useActiveSection } from "@/lib/useActiveSection";

/*
  Client island inside the otherwise-static page shell, so the rail can track
  scroll position without turning the whole dashboard into a client component.
*/
export default function SidebarNav() {
  const active = useActiveSection(NAV_TARGET_IDS);

  return (
    <nav aria-label="Dashboard sections" className="flex-1 px-3 py-4">
      <p className="mb-2 px-3 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-nav-ink-3">
        Dashboard
      </p>

      <ul className="space-y-1">
        {NAV_ITEMS.map(({ label, targetId, Icon }) => {
          const isActive = active === targetId;

          return (
            <li key={label}>
              <a
                href={`#${targetId}`}
                aria-current={isActive ? "location" : undefined}
                className={`relative flex w-full items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-left text-sm transition-colors duration-150 ${
                  isActive
                    ? "border border-brand-line bg-brand-soft font-medium text-brand"
                    : "border border-transparent font-normal text-nav-ink-3 hover:bg-nav-2 hover:text-nav-ink"
                }`}
              >
                {/* Soft bloom under the active item, as in the reference. */}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="bloom pointer-events-none absolute inset-0"
                  />
                )}

                <Icon size={17} className="relative shrink-0" />
                <span className="relative">{label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
