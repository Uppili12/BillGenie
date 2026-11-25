import { notFound } from "next/navigation";
import { CatalogUnavailable, DashboardHeading, DashboardPanel, InvoiceTable } from "../../components/dashboard-content";
import { InvoiceTracker } from "../../components/invoice-tracker";
import { Registry } from "../../components/registry";
import { loadInvoiceRows, loadRegistry } from "../../lib/catalog";
import { formatAmount } from "../../lib/format";
import { detailSections } from "../../lib/sections";
import { securityApi } from "../../lib/security";
import { AdminUserTable } from "../../components/auth-actions";

const content = {
  subscriptions: {
    description: "Review vendors, recurring services, and upcoming sample renewals.",
    panel: "Sample subscriptions",
  },
  vendors: {
    description: "Browse the synthetic directory of subscription service providers.",
    panel: "Sample vendors",
  },
  invoices: {
    description: "Track sample invoice amounts, due dates, and statuses by vendor.",
    panel: "Sample invoices",
  },
  approvals: {
    description: "Preview the invoices that would appear in the CEO approval queue.",
    panel: "Sample approval queue",
  },
  transactions: {
    description: "Review example transaction outcomes from simulated records.",
    panel: "Simulated transaction history",
  },
  notifications: {
    description: "Preview reminder examples generated from sample billing records.",
    panel: "Sample notifications",
  },
  reports: {
    description: "Review billed and simulated paid amounts across the sample records.",
    panel: "Sample billing totals",
  },
  "audit-logs": {
    description: "Review recorded account, session, and permission events with correlation IDs and hash-chain evidence.",
    panel: "Recorded audit events",
  },
  "security-centre": {
    description: "Review authentication and authorization events recorded by the application.",
    panel: "Recorded security events",
  },
  "user-management": {
    description: "Invite users, review account status, change permitted roles, and revoke sessions.",
    panel: "User access management",
  },
  settings: {
    description: "Review the capabilities of this development workspace.",
    panel: "Workspace capabilities",
  },
};

type SectionSlug = keyof typeof content;
type Search = Record<string, string | string[] | undefined>;
type PageProps = { params: Promise<{ section: string }>; searchParams?: Promise<Search> };

async function resolveSection(params: PageProps["params"]) {
  const { section } = await params;
  const match = detailSections.find(({ slug }) => slug === section);

  if (!match) notFound();
  return match;
}

export const dynamicParams = false;
export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return detailSections.map(({ slug }) => ({ section: slug }));
}

export async function generateMetadata({ params }: PageProps) {
  const { label } = await resolveSection(params);
  return { title: label };
}

export default async function SectionPage({ params, searchParams }: PageProps) {
  const { slug, label } = await resolveSection(params);
  const { description, panel } = content[slug];
  const sectionContent = await renderSection(slug, searchParams);
  const dataLabel = slug === "security-centre" ? "Recorded security events" : slug === "audit-logs" ? "Recorded audit events" : slug === "user-management" ? "Account records" : undefined;

  return (
    <>
      <DashboardHeading title={label} description={description} dataLabel={dataLabel} />
      <DashboardPanel title={panel}>
        {sectionContent}
      </DashboardPanel>
    </>
  );
}

async function renderSection(section: SectionSlug, searchParams?: Promise<Search>) {
  if (section === "settings") {
    return <ul className="space-y-3 px-5 py-4 text-slate-700"><li>Dashboard records are synthetic and read-only.</li><li>Authentication is delegated to the configured OpenID Connect provider.</li><li>Real payments and production ERPNext remain disconnected.</li></ul>;
  }

  if (section === "security-centre") {
    const data = await securityApi<{ summary: Record<string, number>; events: Array<{ id: string; occurred_at: string; event_type: string; actor_user_id: string | null; result: string; correlation_id: string }> }>("/security/events");
    if (!data) return <p role="alert" className="px-5 py-4 text-slate-700">Security events are unavailable or your account lacks Security Reader access. No security statistics are estimated.</p>;
    return <><dl className="grid gap-3 border-b border-slate-200 p-5 sm:grid-cols-2 xl:grid-cols-4">{Object.entries(data.summary).map(([name, count]) => <div key={name}><dt className="text-sm text-slate-600">{name.replaceAll("_", " ")}</dt><dd className="text-2xl font-semibold tabular-nums">{count}</dd></div>)}</dl><div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Recorded security events"><table className="dashboard-table"><thead><tr><th>Time</th><th>Event</th><th>Result</th><th>Actor ID</th><th>Correlation ID</th></tr></thead><tbody>{data.events.map((event) => <tr key={event.id}><td>{new Date(event.occurred_at).toLocaleString()}</td><th scope="row">{event.event_type.replaceAll("_", " ")}</th><td>{event.result}</td><td>{event.actor_user_id ?? "Unidentified"}</td><td>{event.correlation_id}</td></tr>)}</tbody></table>{!data.events.length && <p className="px-5 py-4 text-slate-600">No recorded security events.</p>}</div></>;
  }

  if (section === "audit-logs") {
    const events = await securityApi<Array<{ id: string; occurred_at: string; event_type: string; actor_user_id: string | null; resource_type: string; resource_id: string | null; result: string; correlation_id: string; event_hash: string }>>("/audit/events");
    if (!events) return <p role="alert" className="px-5 py-4 text-slate-700">Audit records are unavailable or your account lacks Audit Reader access.</p>;
    return <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Append-only audit events"><table className="dashboard-table"><thead><tr><th>Time</th><th>Event</th><th>Actor</th><th>Resource</th><th>Result</th><th>Record hash</th></tr></thead><tbody>{events.map((event) => <tr key={event.id}><td>{new Date(event.occurred_at).toLocaleString()}</td><th scope="row">{event.event_type.replaceAll("_", " ")}</th><td>{event.actor_user_id ?? "System"}</td><td>{event.resource_type}: {event.resource_id ?? "—"}</td><td>{event.result}</td><td className="max-w-48 truncate font-mono text-xs" title={event.event_hash}>{event.event_hash}</td></tr>)}</tbody></table>{!events.length && <p className="px-5 py-4 text-slate-600">No audit events have been recorded.</p>}</div>;
  }

  if (section === "user-management") {
    const users = await securityApi<Array<{ id: string; email: string; display_name: string; roles: string[]; is_active: boolean; email_verified: boolean; mfa_last_verified_at: string | null; last_login_at: string | null }>>("/admin/users");
    if (!users) return <p role="alert" className="px-5 py-4 text-slate-700">User records are unavailable or your account lacks User Manager access.</p>;
    return <AdminUserTable initialUsers={users} />;
  }

  if (section === "subscriptions") {
    const registry = await loadRegistry();
    return registry ? <Registry registry={registry} /> : <CatalogUnavailable />;
  }

  if (section === "vendors") {
    const registry = await loadRegistry();
    return registry ? <ul className="grid gap-3 px-5 py-4 sm:grid-cols-2">{registry.vendors.map((vendor) => <li key={vendor.id} className="rounded-lg border border-slate-200 p-4"><h3 className="font-semibold">{vendor.name}</h3><p className="mt-1 text-sm text-slate-600">{vendor.category}</p></li>)}</ul> : <CatalogUnavailable />;
  }

  const invoices = await loadInvoiceRows();
  if (!invoices) return <CatalogUnavailable />;

  switch (section) {
    case "invoices":
      return <InvoiceTracker invoices={invoices} search={await searchParams ?? {}} />;
    case "approvals":
      return <InvoiceTable invoices={invoices.filter(({ status }) => status === "Awaiting approval")} />;
    case "transactions":
      return <InvoiceTable invoices={invoices.filter(({ status }) => status === "Simulated paid")} />;
    case "notifications":
      return <ul className="divide-y divide-slate-100 px-5">{invoices.slice().sort((a, b) => a.due_date.localeCompare(b.due_date)).map(({ id, vendor, due_date, status }) => <li key={id} className="py-4"><p className="font-medium">{status === "Awaiting approval" ? "Approval reminder" : "Upcoming renewal reminder"} · {vendor.name}</p><p className="mt-1 text-sm text-slate-600">Sample invoice {id} is due {due_date}. No message was sent.</p></li>)}</ul>;
    case "reports": {
      const total = invoices.reduce((sum, invoice) => sum + invoice.amount_minor, 0);
      const paid = invoices.reduce((sum, invoice) => sum + (invoice.status === "Simulated paid" ? invoice.amount_minor : 0), 0);
      return (
        <dl className="grid gap-5 px-5 py-4 sm:grid-cols-2">
          <div>
            <dt className="text-slate-600">Sample invoice total</dt>
            <dd className="text-xl font-semibold">{formatAmount(total, "INR")}</dd>
          </div>
          <div>
            <dt className="text-slate-600">Simulated paid total</dt>
            <dd className="text-xl font-semibold">{formatAmount(paid, "INR")}</dd>
          </div>
        </dl>
      );
    }
  }
}
