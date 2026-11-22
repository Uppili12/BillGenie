export function formatAmount(amountMinor: number, currency: "INR") {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(amountMinor / 100);
}

const shortDate = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDueDate(due: string) {
  return shortDate.format(new Date(due));
}
