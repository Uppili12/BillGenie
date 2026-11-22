import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import SectionPage, { generateStaticParams } from "../app/[section]/page";
import OverviewPage from "../app/page";
import { DashboardLinks } from "../components/dashboard-navigation";

function mockCatalog(t: TestContext) {
  const records = {
    "/vendors": [
      { id: "V1", name: "Cloud Test", category: "Cloud infrastructure" },
      { id: "V2", name: "Workspace Test", category: "Workplace software" },
    ],
    "/subscriptions": [
      { id: "S1", vendor_id: "V1", name: "Hosting", cadence: "Monthly", next_renewal: "2026-12-03", currency: "INR", expected_amount_minor: 1200 },
      { id: "S2", vendor_id: "V2", name: "Licenses", cadence: "Annual", next_renewal: "2026-12-07", currency: "INR", expected_amount_minor: 2500 },
    ],
    "/invoices": [
      { id: "DEMO-101", subscription_id: "S1", due_date: "2026-12-03", amount_minor: 1200, currency: "INR", status: "Awaiting approval" },
      { id: "DEMO-102", subscription_id: "S2", due_date: "2026-12-07", amount_minor: 2500, currency: "INR", status: "Due soon" },
      { id: "DEMO-103", subscription_id: "S1", due_date: "2026-12-12", amount_minor: 750, currency: "INR", status: "Simulated paid" },
    ],
  };
  t.mock.method(globalThis, "fetch", async (url: string) => {
    const path = new URL(url).pathname;
    return Object.hasOwn(records, path)
      ? Response.json(records[path as keyof typeof records])
      : new Response(null, { status: 404 });
  });
}

test("dashboard links cover all seven sections and identify the current page", () => {
  const html = renderToStaticMarkup(<DashboardLinks pathname="/approvals" />);
  const paths = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);

  assert.deepEqual(paths, ["/", "/subscriptions", "/invoices", "/approvals", "/payments", "/reports", "/settings"]);
  assert.deepEqual(paths.slice(1), generateStaticParams().map(({ section }) => `/${section}`));
  assert.match(html, /<a(?=[^>]*aria-current="page")(?=[^>]*href="\/approvals")[^>]*>Approvals<\/a>/);
  assert.equal(html.match(/aria-current="page"/g)?.length, 1);
});

test("overview labels the sample records as mock data", async (t) => {
  mockCatalog(t);
  const html = renderToStaticMarkup(await OverviewPage());

  assert.match(html, /Mock data/);
  assert.match(html, /DEMO-101/);
  assert.match(html, /Simulated paid/);
});

test("approvals shows only pending sample invoices", async (t) => {
  mockCatalog(t);
  const page = await SectionPage({ params: Promise.resolve({ section: "approvals" }) });
  const html = renderToStaticMarkup(page);

  assert.match(html, /Sample approval queue/);
  assert.match(html, /DEMO-101/);
  assert.doesNotMatch(html, /DEMO-10[23]/);
});

test("invoice tracker combines vendor and status filters", async (t) => {
  mockCatalog(t);
  const html = renderToStaticMarkup(await SectionPage({
    params: Promise.resolve({ section: "invoices" }),
    searchParams: Promise.resolve({ vendor: "V1", status: "Simulated paid" }),
  }));

  assert.match(html, /DEMO-103/);
  assert.doesNotMatch(html, /DEMO-10[12]/);
});

test("overview shows a recoverable message when the catalog is unavailable", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 503 }));
  const html = renderToStaticMarkup(await OverviewPage());

  assert.match(html, /Sample billing data is unavailable/);
  assert.doesNotMatch(html, /DEMO-10/);
});
