import { CatalogUnavailable, DashboardHeading, DashboardPanel, InvoiceTable } from "../components/dashboard-content";
import { loadInvoiceRows } from "../lib/catalog";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const invoices = await loadInvoiceRows();
  const heading = <DashboardHeading title="Overview" description="Track subscription bills, executive approvals, and payment status." />;

  if (!invoices) {
    return (
      <>
        {heading}
        <DashboardPanel title="Recent invoices"><CatalogUnavailable /></DashboardPanel>
      </>
    );
  }

  const summary = [
    { label: "Sample invoices", count: invoices.length },
    { label: "Awaiting approval", count: invoices.filter(({ status }) => status === "Awaiting approval").length },
    { label: "Simulated paid", count: invoices.filter(({ status }) => status === "Simulated paid").length },
  ];

  return (
    <>
      {heading}
      <dl className="mb-7 grid gap-4 sm:grid-cols-3">
        {summary.map(({ label, count }) => (
          <div className="panel px-5 py-4" key={label}>
            <dt className="font-medium text-slate-600">{label}</dt>
            <dd className="mt-2 text-3xl font-semibold tabular-nums">{count}</dd>
          </div>
        ))}
      </dl>
      <DashboardPanel title="Recent invoices">
        <InvoiceTable invoices={invoices} />
      </DashboardPanel>
    </>
  );
}
