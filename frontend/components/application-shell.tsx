"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { DashboardNavigation } from "./dashboard-navigation";

const publicRoutes = ["/login", "/forgot-password", "/reset-password", "/mfa/enroll", "/mfa/verify", "/account-recovery", "/session-expired", "/access-denied"];

export function ApplicationShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAuthenticationRoute = publicRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  if (isAuthenticationRoute) {
    return <><a className="skip-link" href="#main-content">Skip to content</a><main id="main-content" className="min-h-screen bg-slate-50 px-4 py-10 sm:px-8"><div className="mx-auto max-w-xl">{children}</div></main></>;
  }
  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <div className="min-h-screen lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="sidebar">
          <div className="flex items-center gap-3"><span className="brand-mark" aria-hidden="true">B</span><div><div className="text-lg font-semibold leading-tight">BillGenie</div><div className="text-sm text-slate-400">AutomateGenie</div></div></div>
          <DashboardNavigation />
        </aside>
        <main id="main-content" tabIndex={-1} className="min-w-0 px-4 py-7 sm:px-8 lg:px-10 lg:py-10"><div className="mx-auto max-w-6xl">{children}</div></main>
      </div>
    </>
  );
}
