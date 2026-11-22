export const sections = [
  { slug: "", label: "Overview", href: "/" },
  { slug: "subscriptions", label: "Subscriptions", href: "/subscriptions" },
  { slug: "invoices", label: "Invoices", href: "/invoices" },
  { slug: "approvals", label: "Approvals", href: "/approvals" },
  { slug: "payments", label: "Payments", href: "/payments" },
  { slug: "reports", label: "Reports", href: "/reports" },
  { slug: "settings", label: "Settings", href: "/settings" },
] as const;

export const [, ...detailSections] = sections;
