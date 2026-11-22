import { notFound } from "next/navigation";
import { CatalogUnavailable, DashboardHeading, DashboardPanel, InvoiceTable } from "../../components/dashboard-content";
import { InvoiceTracker } from "../../components/invoice-tracker";
import { Registry } from "../../components/registry";
import { loadInvoiceRows, loadRegistry } from "../../lib/catalog";
import { formatAmount } from "../../lib/format";
import { detailSections } from "../../lib/sections";

const content = {
  subscriptions: {
    description: "Review vendors, recurring services, and upcoming sample renewals.",
    panel: "Sample subscriptions",
  },
  invoices: {
    description: "Track sample invoice amounts, due dates, and statuses by vendor.",
    panel: "Sample invoices",
  },
  approvals: {
    description: "Preview the invoices that would appear in the CEO approval queue.",
    panel: "Sample approval queue",
  },
  payments: {
    description: "Review example payment outcomes from simulated records.",
    panel: "Simulated payment history",
  },
  reports: {
    description: "Review billed and simulated paid amounts across the sample records.",
    panel: "Sample billing totals",
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

  return (
    <>
      <DashboardHeading title={label} description={description} />
      <DashboardPanel title={panel}>
        {sectionContent}
      </DashboardPanel>
    </>
  );
}

async function renderSection(section: SectionSlug, searchParams?: Promise<Search>) {
  if (section === "settings") {
    return (
      <ul className="space-y-2 px-5 py-4 text-slate-700">
        <li>Dashboard access is local and read-only.</li>
        <li>Authentication, MFA, and role-based access are planned.</li>
        <li>Payment providers and ERPNext are disconnected.</li>
      </ul>
    );
  }

  if (section === "subscriptions") {
    const registry = await loadRegistry();
    return registry ? <Registry registry={registry} /> : <CatalogUnavailable />;
  }

  const invoices = await loadInvoiceRows();
  if (!invoices) return <CatalogUnavailable />;

  switch (section) {
    case "invoices":
      return <InvoiceTracker invoices={invoices} search={await searchParams ?? {}} />;
    case "approvals":
      return <InvoiceTable invoices={invoices.filter(({ status }) => status === "Awaiting approval")} />;
    case "payments":
      return <InvoiceTable invoices={invoices.filter(({ status }) => status === "Simulated paid")} />;
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
