import AnomalyAlerts from "@/components/AnomalyAlerts";
import CategorySpendingChart from "@/components/CategorySpendingChart";
import MonthlySpendingChart from "@/components/MonthlySpendingChart";
import RecentTransactions from "@/components/RecentTransactions";
import SummaryCards from "@/components/SummaryCards";
import TopMerchants from "@/components/TopMerchants";
import MobileHeader from "@/components/MobileHeader";

const navigation = [
  "Overview",
  "Transactions",
  "Analytics",
  "Anomalies",
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f6f7f9]">
      <MobileHeader />
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-[#111827] text-white lg:flex">
        <div className="flex h-20 items-center border-b border-white/10 px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 font-bold text-white">
              F
            </div>

            <div>
              <p className="text-base font-semibold tracking-tight">
                FinanceIQ
              </p>
              <p className="text-xs text-gray-400">
                ML Finance Analytics
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6">
          <p className="mb-3 px-3 text-xs font-medium uppercase tracking-wider text-gray-500">
            Dashboard
          </p>

          <div className="space-y-1">
            {navigation.map((item, index) => (
              <button
                key={item}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
                  index === 0
                    ? "bg-white/10 text-white"
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    index === 0 ? "bg-emerald-400" : "bg-gray-600"
                  }`}
                />

                {item}
              </button>
            ))}
          </div>
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="rounded-xl bg-white/5 p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-sm font-medium">
                ML Pipeline
              </span>
            </div>

            <p className="text-xs leading-5 text-gray-400">
              Categorization and anomaly detection models ready.
            </p>
          </div>
        </div>
      </aside>

      <main className="lg:ml-64">
        <header className="sticky top-0 z-10 hidden border-b border-gray-200 bg-white/90 backdrop-blur lg:block">
          <div className="flex h-20 items-center justify-between px-6 lg:px-10">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-gray-900">
                Financial Overview
              </h1>

              <p className="mt-1 text-sm text-gray-500">
                ML-powered spending insights and transaction monitoring
              </p>
            </div>

            <div className="hidden items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-2 sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />

              <span className="text-xs font-medium text-gray-600">
                API Connected
              </span>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl space-y-8 p-6 lg:p-10">
          <div className="lg:hidden">
  <h1 className="text-xl font-semibold tracking-tight text-gray-900">
    Financial Overview
  </h1>

  <p className="mt-1 text-sm leading-6 text-gray-500">
    ML-powered spending insights and transaction monitoring
  </p>
</div>
          <section>
            <div className="mb-5 flex items-end justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-600">
                  Dashboard
                </p>

                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-gray-900">
                  Spending at a glance
                </h2>
              </div>

              <p className="hidden text-sm text-gray-500 md:block">
                Live data from FastAPI
              </p>
            </div>

            <SummaryCards />
          </section>

          <section className="grid gap-6 xl:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm xl:col-span-2">
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900">
                  Monthly Spending
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  Spending trends over time
                </p>
              </div>

              <MonthlySpendingChart />
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900">
                  Spending by Category
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  ML-classified purchases
                </p>
              </div>

              <CategorySpendingChart />
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
         <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
  <div className="mb-6 flex items-center justify-between">
    <div>
      <h3 className="font-semibold text-gray-900">
        Top Merchants
      </h3>

      <p className="mt-1 text-sm text-gray-500">
        Highest spending by merchant
      </p>
    </div>

    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
      Top 5
    </span>
  </div>

  <TopMerchants />
</div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
  <div className="mb-6 flex items-center justify-between">
    <div>
      <h3 className="font-semibold text-gray-900">
        Anomaly Detection
      </h3>

      <p className="mt-1 text-sm text-gray-500">
        Unusual spending identified by ML
      </p>
    </div>

    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
      ML
    </span>
  </div>

  <AnomalyAlerts />
</div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
  <RecentTransactions />
</section>
        </div>
      </main>
    </div>
  );
}