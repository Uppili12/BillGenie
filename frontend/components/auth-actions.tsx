"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiOriginForBrowser } from "../lib/api-origin";

function csrfToken() {
  return document.cookie.split("; ").find((value) => value.startsWith("bg_csrf="))?.slice("bg_csrf=".length) ?? "";
}

export function SessionActions() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  async function post(path: string) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`${apiOriginForBrowser}${path}`, { method: "POST", credentials: "include", headers: { "X-CSRF-Token": csrfToken() } });
      if (!response.ok) throw new Error();
      const result = await response.json() as { logout_url?: string };
      if (result.logout_url) window.location.assign(result.logout_url);
      else { router.replace("/login"); router.refresh(); }
    } catch { setError("We could not update your session. Refresh and try again."); }
    finally { setBusy(false); }
  }
  return <div className="mt-5 flex flex-wrap gap-3"><button className="button-primary" disabled={busy} onClick={() => void post("/auth/logout")}>Sign out</button><button className="button-secondary" disabled={busy} onClick={() => void post("/auth/logout-all")}>Sign out from all devices</button>{error && <p role="alert" className="w-full text-sm text-red-700">{error}</p>}</div>;
}

export function AdminUserTable({ initialUsers }: { initialUsers: Array<{ id: string; email: string; roles: string[]; is_active: boolean; email_verified: boolean; mfa_last_verified_at: string | null; last_login_at: string | null }> }) {
  const [users, setUsers] = useState(initialUsers);
  const [error, setError] = useState("");
  const [invite, setInvite] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessions, setSessions] = useState<Array<{ id: string; created_at: string; expires_at: string }> | null>(null);
  const [sessionOwner, setSessionOwner] = useState("");
  async function changeStatus(userId: string, isActive: boolean) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`${apiOriginForBrowser}/admin/users/${encodeURIComponent(userId)}/status`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken() }, body: JSON.stringify({ is_active: isActive }) });
      if (!response.ok) throw new Error();
      setUsers((current) => current.map((user) => user.id === userId ? { ...user, is_active: isActive } : user));
    } catch { setError("The account status could not be changed."); }
    finally { setBusy(false); }
  }
  async function createInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setInvite("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${apiOriginForBrowser}/admin/invitations`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken() }, body: JSON.stringify({ email: data.get("email"), role: data.get("role") }) });
      if (!response.ok) throw new Error();
      const result = await response.json() as { invite_url: string };
      setInvite(result.invite_url);
    } catch { setError("The invitation could not be created."); }
    finally { setBusy(false); }
  }
  async function assignRole(userId: string, role: string) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`${apiOriginForBrowser}/admin/users/${encodeURIComponent(userId)}/roles`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken() }, body: JSON.stringify({ roles: [role] }) });
      if (!response.ok) throw new Error();
      setUsers((current) => current.map((user) => user.id === userId ? { ...user, roles: [role] } : user));
    } catch { setError("The role could not be changed. CEO assignments require the separately authorized process."); }
    finally { setBusy(false); }
  }
  async function viewSessions(userId: string) {
    setError(""); setSessionOwner(userId);
    try {
      const response = await fetch(`${apiOriginForBrowser}/admin/users/${encodeURIComponent(userId)}/sessions`, { credentials: "include" });
      if (!response.ok) throw new Error();
      setSessions(await response.json());
    } catch { setError("Active sessions could not be loaded."); setSessions(null); }
  }
  async function revokeSession(sessionId: string) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`${apiOriginForBrowser}/admin/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE", credentials: "include", headers: { "X-CSRF-Token": csrfToken() } });
      if (!response.ok) throw new Error();
      setSessions((current) => current?.filter((session) => session.id !== sessionId) ?? null);
    } catch { setError("The session could not be revoked."); }
    finally { setBusy(false); }
  }
  return <>
    <form className="grid gap-3 border-b border-slate-200 p-5 sm:grid-cols-[1fr_12rem_auto]" onSubmit={createInvite}>
      <label className="text-sm font-medium">Work email<input className="field-control mt-1" name="email" type="email" autoComplete="email" required maxLength={320} /></label>
      <label className="text-sm font-medium">Role<select className="field-control mt-1" name="role"><option>Finance</option><option>Auditor</option><option>Administrator</option></select></label>
      <button className="button-primary self-end" disabled={busy}>Create invite</button>
    {invite && <p role="status" className="sm:col-span-3 break-all text-sm">Share this one-time link through an approved channel: <a className="text-sky-800 underline" href={invite}>{invite}</a></p>}
    </form>
    {error && <p role="alert" className="px-5 pt-4 text-sm text-red-700">{error}</p>}
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="User account status"><table className="dashboard-table"><thead><tr><th>Email</th><th>Roles</th><th>Status</th><th>Email verified</th><th>Last MFA sign-in</th><th>Last login</th><th>Access actions</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><th scope="row" className="font-medium">{user.email}</th><td>{user.roles.join(", ")}</td><td>{user.is_active ? "Active" : "Inactive"}</td><td>{user.email_verified ? "Verified" : "Unverified"}</td><td>{user.mfa_last_verified_at ? new Date(user.mfa_last_verified_at).toLocaleString() : "Not observed"}</td><td>{user.last_login_at ? new Date(user.last_login_at).toLocaleString() : "Never"}</td><td><div className="flex flex-wrap items-center gap-3"><button className="text-sm text-sky-800 underline" disabled={busy} onClick={() => void changeStatus(user.id, !user.is_active)}>{user.is_active ? "Deactivate" : "Activate"}</button><button className="text-sm text-sky-800 underline" disabled={busy} onClick={() => void viewSessions(user.id)}>Sessions</button><label className="sr-only" htmlFor={`role-${user.id}`}>Assign role for {user.email}</label><select id={`role-${user.id}`} className="field-control max-w-36" defaultValue={user.roles[0] ?? "Finance"}><option>Finance</option><option>Auditor</option><option>Administrator</option></select><button className="text-sm text-sky-800 underline" disabled={busy} onClick={(event) => { const select = event.currentTarget.parentElement?.querySelector("select"); if (select) void assignRole(user.id, select.value); }}>Save role</button></div></td></tr>)}</tbody></table></div>
    {sessionOwner && <div className="border-t border-slate-200 p-5"><h3 className="font-semibold">Active sessions</h3>{sessions?.length ? <ul className="mt-3 divide-y divide-slate-100">{sessions.map((session) => <li key={session.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><span>Expires {new Date(session.expires_at).toLocaleString()}</span><button className="text-sky-800 underline" disabled={busy} onClick={() => void revokeSession(session.id)}>Revoke session</button></li>)}</ul> : <p className="mt-2 text-sm text-slate-600">No active sessions were returned.</p>}</div>}
  </>;
}
