import type { RegistryData } from "../lib/catalog";
import { formatAmount, formatDueDate } from "../lib/format";

export function Registry({ registry }: { registry: RegistryData }) {
  return (
    <>
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Sample subscriptions">
        <table className="dashboard-table">
          <thead>
            <tr>
              <th scope="col">Subscription</th>
              <th scope="col">Cadence</th>
              <th scope="col">Next renewal</th>
              <th scope="col">Expected amount</th>
            </tr>
          </thead>
          <tbody>
            {registry.subscriptions.map((subscription) => (
              <tr key={subscription.id}>
                <th scope="row" className="font-medium">
                  {subscription.name}
                  <span className="block text-sm font-normal text-slate-600">{subscription.vendor.name}</span>
                </th>
                <td>{subscription.cadence}</td>
                <td><time dateTime={subscription.next_renewal}>{formatDueDate(subscription.next_renewal)}</time></td>
                <td className="tabular-nums">{formatAmount(subscription.expected_amount_minor, subscription.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-slate-200 px-5 py-4">
        <h3 className="font-semibold">Vendor directory</h3>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {registry.vendors.map((vendor) => (
            <li key={vendor.id} className="rounded-md border border-slate-200 px-3 py-2">
              <div className="font-medium">{vendor.name}</div>
              <div className="text-sm text-slate-600">{vendor.category}</div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
