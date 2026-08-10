import AnomalyAlerts from "@/components/AnomalyAlerts";
import CategorySpendingChart from "@/components/CategorySpendingChart";
import MonthlySpendingChart from "@/components/MonthlySpendingChart";
import RecentTransactions from "@/components/RecentTransactions";
import SummaryCards from "@/components/SummaryCards";
import TopMerchants from "@/components/TopMerchants";
import MobileHeader from "@/components/MobileHeader";
import DataSourceControls from "@/components/DataSourceControls";
import SavingsGoals from "@/components/SavingsGoals";
import AuthControls from "@/components/AuthControls";
import SidebarNav from "@/components/SidebarNav";
import { Panel, PanelHeader, Pill, SectionLabel } from "@/components/ui/Panel";
import { IconShield } from "@/components/ui/Icons";

export default function Home() {
  return (
    <div className="relative min-h-dvh bg-canvas">
      <div className="ambient" aria-hidden="true" />

      <a
        href="#dashboard"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-brand-ink"
      >
        Skip to dashboard
      </a>

      <div className="relative z-10">
        <MobileHeader />

        {/* Desktop navigation rail — an inset card, not a full-bleed column. */}
        <aside className="fixed inset-y-0 left-0 hidden w-64 p-3 lg:block">
          <div className="flex h-full flex-col overflow-hidden rounded-panel border border-nav-line bg-nav">
            <div className="flex h-16 items-center px-5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm font-bold text-brand-ink">
                  F
                </span>

                <p className="text-[0.9375rem] font-semibold tracking-tight text-nav-ink">
                  FinanceIQ
                </p>
              </div>
            </div>

            <SidebarNav />

            <div className="p-3">
              <div className="rounded-xl border border-nav-line bg-inset p-3.5">
                <div className="mb-1.5 flex items-center gap-2">
                  <IconShield size={14} className="text-positive" />
                  <span className="text-[0.8125rem] font-medium text-nav-ink">
                    System status
                  </span>
                </div>

                <p className="text-xs leading-5 text-nav-ink-3">
                  API connected · ML models ready
                </p>
              </div>
            </div>
          </div>
        </aside>

        <main className="lg:ml-64">
          <header className="sticky top-0 z-30 hidden border-b border-hairline bg-canvas/80 backdrop-blur lg:block">
            <div className="flex h-20 items-center justify-between gap-6 px-6 xl:px-8">
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold tracking-tight text-ink">
                  Financial{" "}
                  <span className="font-normal text-brand">Overview</span>
                </h1>

                <p className="mt-0.5 truncate text-[0.8125rem] text-ink-3">
                  ML-powered spending insights and transaction monitoring
                </p>
              </div>

              <AuthControls />
            </div>
          </header>

          <div
            id="dashboard"
            className="mx-auto max-w-[90rem] scroll-mt-24 space-y-7 p-4 sm:p-6 xl:p-8"
          >
            <div className="lg:hidden">
              <h1 className="text-xl font-semibold tracking-tight text-ink">
                Financial <span className="font-normal text-brand">Overview</span>
              </h1>

              <p className="mt-1 text-sm leading-6 text-ink-3">
                ML-powered spending insights and transaction monitoring
              </p>
            </div>

            <section id="section-source" aria-labelledby="label-source">
              <SectionLabel id="label-source">Data source</SectionLabel>

              <DataSourceControls />
            </section>

            <section id="section-metrics" aria-labelledby="label-metrics">
              <SectionLabel id="label-metrics" meta="Live data from FastAPI">
                Key metrics
              </SectionLabel>

              <SummaryCards />
            </section>

            {/* scroll-mt clears the sticky header when jumped to from the nav. */}
            <section
              id="section-spending"
              aria-labelledby="label-spending"
              className="scroll-mt-24"
            >
              <SectionLabel id="label-spending">Spending analysis</SectionLabel>

              <div className="grid gap-5 xl:grid-cols-3">
                <Panel className="xl:col-span-2">
                  <PanelHeader
                    title="Monthly Spending"
                    description="Total spend per month across the active dataset"
                    className="mb-6"
                  />

                  <MonthlySpendingChart />
                </Panel>

                <Panel>
                  <PanelHeader
                    title="Spending by Category"
                    description="ML-classified purchases"
                    className="mb-6"
                  />

                  <CategorySpendingChart />
                </Panel>
              </div>
            </section>

            <section id="section-merchants" aria-labelledby="label-merchants">
              <SectionLabel id="label-merchants">Merchants and risk</SectionLabel>

              <div className="grid gap-5 lg:grid-cols-2">
                <Panel>
                  <PanelHeader
                    title="Top Merchants"
                    description="Highest spending by merchant"
                    action={<Pill>Top 5</Pill>}
                    className="mb-5"
                  />

                  <TopMerchants />
                </Panel>

                <Panel id="section-anomalies" className="scroll-mt-24">
                  <PanelHeader
                    title="Anomaly Detection"
                    description="Unusual spending identified by ML"
                    action={<Pill tone="caution">ML</Pill>}
                    className="mb-5"
                  />

                  <AnomalyAlerts />
                </Panel>
              </div>
            </section>

            <section
              id="section-transactions"
              aria-labelledby="label-transactions"
              className="scroll-mt-24"
            >
              <SectionLabel id="label-transactions">Transactions</SectionLabel>

              {/* Flush so the table can run edge to edge inside the panel. */}
              <Panel flush className="overflow-hidden">
                <RecentTransactions />
              </Panel>
            </section>

            <section id="section-planning" aria-labelledby="label-planning">
              <SectionLabel id="label-planning">Planning</SectionLabel>

              <SavingsGoals />
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
