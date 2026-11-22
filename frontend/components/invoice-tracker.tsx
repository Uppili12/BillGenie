import { InvoiceTable } from "./dashboard-content";
import { type InvoiceRow, invoiceStatuses } from "../lib/catalog";

export function InvoiceTracker({
  invoices,
  search,
}: {
  invoices: InvoiceRow[];
  search: Record<string, string | string[] | undefined>;
}) {
  const vendors = new Map(invoices.map(({ vendor }) => [vendor.id, vendor.name]));
  const selectedVendor = [...vendors.keys()].find((vendor) => vendor === search.vendor) ?? "";
  const selectedStatus = invoiceStatuses.find((status) => status === search.status) ?? "";
  const matchingInvoices = invoices.filter(({ vendor, status }) =>
    (!selectedVendor || vendor.id === selectedVendor) && (!selectedStatus || status === selectedStatus)
  );

  return (
    <>
      <form action="/invoices" method="get" className="flex flex-wrap items-end gap-3 border-b border-slate-200 px-5 py-4">
        <label className="grid gap-1 text-sm font-medium">
          Vendor
          <select name="vendor" defaultValue={selectedVendor} className="rounded-md border border-slate-400 bg-white px-2 py-2">
            <option value="">All vendors</option>
            {[...vendors].map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Status
          <select name="status" defaultValue={selectedStatus} className="rounded-md border border-slate-400 bg-white px-2 py-2">
            <option value="">All statuses</option>
            {invoiceStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </label>
        <button type="submit" className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700">Apply filters</button>
      </form>
      <InvoiceTable invoices={matchingInvoices} />
    </>
  );
}
