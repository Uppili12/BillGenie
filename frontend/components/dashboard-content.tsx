import type { ReactNode } from "react";
import type { InvoiceRow } from "../lib/catalog";
import { formatAmount, formatDueDate } from "../lib/format";

export function DashboardHeading({ title, description, dataLabel = "Mock data" }: { title: string; description: string; dataLabel?: string }) {
  return (
    <header className="mb-7 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 text-slate-600">{description}</p>
      </div>
      <span className="demo-label">{dataLabel}</span>
    </header>
  );
}

export function DashboardPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel">
      <h2 className="border-b border-slate-200 px-5 py-4 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

const statusClass = {
  "Awaiting approval": "bg-amber-100 text-amber-900",
  "Due soon": "bg-sky-100 text-sky-900",
  "Simulated paid": "bg-emerald-100 text-emerald-900",
};

export function CatalogUnavailable() {
  return <p role="status" className="px-5 py-4 text-slate-700">Sample billing data is unavailable. Start the local BillGenie API and refresh this page.</p>;
}

export function InvoiceTable({ invoices }: { invoices: readonly InvoiceRow[] }) {
  if (invoices.length === 0) {
    return <p className="px-5 py-4 text-slate-700">No sample invoices to display.</p>;
  }

  return (
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Sample invoices">
      <table className="dashboard-table">
        <thead>
          <tr>
            <th scope="col">Vendor and invoice</th>
            <th scope="col">Due date</th>
            <th scope="col">Amount</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map(({ id, vendor, subscription, due_date, amount_minor, currency, status }) => (
            <tr key={id}>
              <th scope="row" className="font-medium">
                {vendor.name}
                <span className="block text-sm font-normal text-slate-600">{id} · {subscription.name}</span>
              </th>
              <td><time dateTime={due_date}>{formatDueDate(due_date)}</time></td>
              <td className="tabular-nums">{formatAmount(amount_minor, currency)}</td>
              <td><span className={`status-label ${statusClass[status]}`}>{status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
