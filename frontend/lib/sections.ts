export const sections = [
  { slug: "", label: "Overview", href: "/" },
  { slug: "subscriptions", label: "Subscriptions", href: "/subscriptions" },
  { slug: "vendors", label: "Vendors", href: "/vendors" },
  { slug: "invoices", label: "Invoices", href: "/invoices" },
  { slug: "approvals", label: "Payment Approvals", href: "/approvals" },
  { slug: "transactions", label: "Transactions", href: "/transactions" },
  { slug: "notifications", label: "Notifications", href: "/notifications" },
  { slug: "reports", label: "Reports", href: "/reports" },
  { slug: "audit-logs", label: "Audit Logs", href: "/audit-logs" },
  { slug: "security-centre", label: "Security Centre", href: "/security-centre" },
  { slug: "user-management", label: "User Management", href: "/user-management" },
  { slug: "account", label: "My Account", href: "/account" },
  { slug: "settings", label: "Settings", href: "/settings" },
] as const;

export type DetailSection = Exclude<(typeof sections)[number], { slug: "" | "account" }>;
export const detailSections = sections.filter(({ slug }) => slug !== "" && slug !== "account") as DetailSection[];
