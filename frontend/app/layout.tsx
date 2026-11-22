import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DashboardNavigation } from "../components/dashboard-navigation";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "BillGenie", template: "%s | BillGenie" },
  description: "AutomateGenie's subscription billing and approval dashboard.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <div className="min-h-screen lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
          <aside className="sidebar">
            <div className="flex items-center gap-3">
              <span className="brand-mark" aria-hidden="true">B</span>
              <div>
                <div className="text-lg font-semibold leading-tight">BillGenie</div>
                <div className="text-sm text-slate-400">AutomateGenie</div>
              </div>
            </div>
            <DashboardNavigation />
          </aside>
          <main id="main-content" tabIndex={-1} className="min-w-0 px-4 py-7 sm:px-8 lg:px-10 lg:py-10">
            <div className="mx-auto max-w-6xl">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
