import { CatalogUnavailable, DashboardHeading, DashboardPanel, InvoiceTable } from "../components/dashboard-content";
import { loadInvoiceRows, loadRegistry } from "../lib/catalog";
import { formatAmount, formatDueDate } from "../lib/format";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const invoices = await loadInvoiceRows();
  const registry = await loadRegistry();
  const heading = <DashboardHeading title="Overview" description="Track subscription bills, executive approvals, and payment status." />;

  if (!invoices) {
    return (
      <>
        {heading}
        <DashboardPanel title="Recent invoices"><CatalogUnavailable /></DashboardPanel>
      </>
    );
  }

  const subscriptions = registry?.subscriptions ?? [];
  const pending = invoices.filter(({ status }) => status === "Awaiting approval").length;
  const simulatedPaid = invoices.filter(({ status }) => status === "Simulated paid").length;
  const monthly = subscriptions.reduce((sum, item) => sum + (item.cadence === "Monthly" ? item.expected_amount_minor : Math.round(item.expected_amount_minor / 12)), 0);
  const metrics = [
    ["Active subscriptions", String(subscriptions.length), "Across sample vendors"],
    ["Monthly run rate", formatAmount(monthly, "INR"), "Estimated from sample cadence"],
    ["Upcoming payments", String(invoices.filter(({ status }) => status === "Due soon").length), "Sample invoices marked due soon"],
    ["Pending approvals", String(pending), "No actions are available in this demo"],
    ["Overdue payments", "0", "No overdue sample records"],
    ["Successful payments", String(simulatedPaid), "Simulated outcomes only"],
    ["Failed payments", "0", "No failed sample records"],
  ];

  return (
    <>
      {heading}
      <dl className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value, note]) => (
          <div className="panel px-5 py-4" key={label}>
            <dt className="text-sm font-medium text-slate-600">{label}</dt>
            <dd className="mt-2 text-2xl font-semibold tabular-nums">{value}</dd>
            <dd className="mt-1 text-xs text-slate-500">{note}</dd>
          </div>
        ))}
      </dl>
      <div className="mb-7 grid gap-5 xl:grid-cols-2">
        <DashboardPanel title="Upcoming renewals">
          {subscriptions.length ? <ul className="divide-y divide-slate-100 px-5">{subscriptions.slice().sort((a, b) => a.next_renewal.localeCompare(b.next_renewal)).slice(0, 4).map((item) => <li key={item.id} className="flex items-center justify-between gap-4 py-3"><span><span className="block font-medium">{item.vendor.name}</span><span className="text-sm text-slate-500">{item.name}</span></span><span className="text-right"><time className="block text-sm" dateTime={item.next_renewal}>{formatDueDate(item.next_renewal)}</time><span className="text-sm text-slate-500">{formatAmount(item.expected_amount_minor, item.currency)}</span></span></li>)}</ul> : <CatalogUnavailable />}
        </DashboardPanel>
        <DashboardPanel title="Monthly expense snapshot">
          <div className="space-y-4 px-5 py-5" aria-label="Sample monthly subscription expense by vendor">
            {(registry?.vendors ?? []).map((vendor) => {
              const amount = subscriptions.filter((item) => item.vendor.id === vendor.id).reduce((sum, item) => sum + (item.cadence === "Monthly" ? item.expected_amount_minor : Math.round(item.expected_amount_minor / 12)), 0);
              const percent = monthly ? Math.max(4, Math.round(amount / monthly * 100)) : 0;
              return <div key={vendor.id}><div className="mb-1 flex justify-between gap-3 text-sm"><span>{vendor.name}</span><span className="tabular-nums text-slate-600">{formatAmount(amount, "INR")}</span></div><div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-teal-600" style={{ width: `${percent}%` }} /></div></div>;
            })}
          </div>
        </DashboardPanel>
      </div>
      <DashboardPanel title="Recent invoices">
        <InvoiceTable invoices={invoices} />
      </DashboardPanel>
    </>
  );
}
