export const invoiceStatuses = ["Awaiting approval", "Due soon", "Simulated paid"] as const;
export type InvoiceStatus = (typeof invoiceStatuses)[number];

type Vendor = { id: string; name: string; category: string };
type Subscription = {
  id: string;
  vendor_id: string;
  name: string;
  cadence: "Monthly" | "Annual";
  next_renewal: string;
  currency: "INR";
  expected_amount_minor: number;
};
type Invoice = {
  id: string;
  subscription_id: string;
  due_date: string;
  currency: "INR";
  amount_minor: number;
  status: InvoiceStatus;
};

export type InvoiceRow = Invoice & { vendor: Vendor; subscription: Subscription };
export type RegistryData = {
  vendors: Vendor[];
  subscriptions: (Subscription & { vendor: Vendor })[];
};

type Catalog = {
  vendors: Vendor;
  subscriptions: Subscription;
  invoices: Invoice;
};

async function fetchRecords<Resource extends keyof Catalog>(resource: Resource): Promise<Catalog[Resource][]> {
  const response = await fetch(`http://127.0.0.1:8000/${resource}`, {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(2500),
  });
  if (!response.ok) throw new Error("Catalog request failed");
  const records: unknown = await response.json();
  if (!Array.isArray(records)) throw new Error("Catalog response must be a list");
  return records;
}

export async function loadRegistry(): Promise<RegistryData | null> {
  try {
    const [vendors, subscriptions] = await Promise.all([
      fetchRecords("vendors"),
      fetchRecords("subscriptions"),
    ]);
    const vendorById = new Map(vendors.map((vendor) => [vendor.id, vendor]));
    return {
      vendors,
      subscriptions: subscriptions.map((subscription) => {
        const vendor = vendorById.get(subscription.vendor_id);
        if (!vendor) throw new Error("Subscription vendor is missing");
        return { ...subscription, vendor };
      }),
    };
  } catch {
    return null;
  }
}

export async function loadInvoiceRows(): Promise<InvoiceRow[] | null> {
  try {
    const [registry, invoices] = await Promise.all([loadRegistry(), fetchRecords("invoices")]);
    if (!registry) return null;
    const subscriptionById = new Map(registry.subscriptions.map((subscription) => [subscription.id, subscription]));
    return invoices.map((invoice) => {
      const subscription = subscriptionById.get(invoice.subscription_id);
      if (!subscription) throw new Error("Invoice subscription is missing");
      return { ...invoice, vendor: subscription.vendor, subscription };
    });
  } catch {
    return null;
  }
}
