import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ApplicationShell } from "../components/application-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "BillGenie", template: "%s | BillGenie" },
  description: "AutomateGenie's subscription billing and approval dashboard.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ApplicationShell>{children}</ApplicationShell>
      </body>
    </html>
  );
}
