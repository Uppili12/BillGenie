import { DashboardHeading, DashboardPanel } from "../../components/dashboard-content";
import { SessionActions } from "../../components/auth-actions";
import { securityApi } from "../../lib/security";
const identityAccountUrl = process.env.NEXT_PUBLIC_IDENTITY_ACCOUNT_URL ?? "http://localhost:8080/realms/billgenie/account";

type Account = { id: string; email: string; display_name: string; roles: string[]; mfa_last_verified_at: string | null; mfa_enrolled_methods: string[]; last_login_at: string | null };
type Session = { id: string; created_at: string; expires_at: string; current: boolean };
type LoginEvent = { occurred_at: string; event_type: string; result: string; correlation_id: string };

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const [account, sessions, history] = await Promise.all([
    securityApi<Account>("/auth/me"), securityApi<Session[]>("/auth/sessions"), securityApi<LoginEvent[]>("/auth/history"),
  ]);
  if (!account) return <><DashboardHeading title="My Account" description="Your account session could not be verified." dataLabel="Account security" /><p role="alert" className="panel p-5">Your session may have expired. <a className="text-sky-800 underline" href="/session-expired">Sign in again</a>.</p></>;
  return <>
    <DashboardHeading title="My Account" description="Review your verified identity, security status, and active sessions." dataLabel="Account security" />
    <div className="grid gap-5 xl:grid-cols-2">
      <DashboardPanel title="Profile"><dl className="grid gap-4 p-5 sm:grid-cols-2"><div><dt className="text-sm text-slate-500">Name</dt><dd className="font-medium">{account.display_name || "Not provided"}</dd></div><div><dt className="text-sm text-slate-500">Verified email</dt><dd className="font-medium">{account.email}</dd></div><div><dt className="text-sm text-slate-500">Mobile</dt><dd className="font-medium">Managed by identity provider</dd></div><div><dt className="text-sm text-slate-500">Roles</dt><dd className="font-medium">{account.roles.join(", ")}</dd></div></dl></DashboardPanel>
      <DashboardPanel title="Authentication"><dl className="space-y-3 p-5"><div><dt className="text-sm text-slate-500">Last MFA factor signal</dt><dd>{account.mfa_last_verified_at ? new Date(account.mfa_last_verified_at).toLocaleString() : "Not reported by identity provider"}</dd></div><div><dt className="text-sm text-slate-500">Recorded MFA methods</dt><dd>{account.mfa_enrolled_methods.length ? account.mfa_enrolled_methods.join(", ") : "No method has been reported"}</dd></div><div><dt className="text-sm text-slate-500">Last successful sign-in</dt><dd>{account.last_login_at ? new Date(account.last_login_at).toLocaleString() : "Not recorded"}</dd></div><div className="flex flex-wrap gap-4 pt-2"><a className="text-sky-800 underline" href={identityAccountUrl}>Password and MFA settings</a><a className="text-sky-800 underline" href="/account-recovery">Account recovery</a></div></dl></DashboardPanel>
    </div>
    <div className="mt-5 grid gap-5 xl:grid-cols-2">
      <DashboardPanel title="Active sessions"><ul className="divide-y divide-slate-100 px-5">{(sessions ?? []).map((item) => <li key={item.id} className="flex justify-between gap-3 py-3"><span className="text-sm">{item.current ? "This device" : "Signed-in device"} {item.current && <span className="status-label bg-emerald-100 text-emerald-900">Current</span>}</span><span className="text-right text-xs text-slate-500">Expires {new Date(item.expires_at).toLocaleString()}</span></li>)}{!sessions?.length && <li className="py-4 text-sm text-slate-600">No active sessions were returned.</li>}</ul><div className="border-t border-slate-200 p-5"><SessionActions /></div></DashboardPanel>
      <DashboardPanel title="Recent sign-in history"><ul className="divide-y divide-slate-100 px-5">{(history ?? []).map((event, index) => <li key={`${event.correlation_id}-${index}`} className="py-3"><span className="font-medium">{event.event_type.replaceAll("_", " ")}</span><span className="ml-2 text-sm text-slate-500">{event.result} · {new Date(event.occurred_at).toLocaleString()}</span></li>)}{!history?.length && <li className="py-4 text-sm text-slate-600">No recorded sign-in events.</li>}</ul></DashboardPanel>
    </div>
  </>;
}
