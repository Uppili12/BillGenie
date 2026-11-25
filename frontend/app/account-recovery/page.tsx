import Link from "next/link";
import { AuthCard } from "../../components/auth-card";

export default function AccountRecoveryPage() {
  return <AuthCard title="Recover your account" description="Use your organization’s approved identity recovery process to restore account access.">
    <p className="rounded-md bg-slate-50 p-4 text-sm leading-6 text-slate-700">Recovery codes are single-use and managed by the identity provider. If you have lost access to every enrolled factor, contact your organization administrator for its identity-proofing procedure. MFA resets are not performed from an active BillGenie session.</p>
    <a className="button-primary mt-5 block text-center" href="http://localhost:8080/realms/billgenie/account">Open recovery options</a>
    <Link className="mt-5 inline-block text-sm text-sky-800 underline" href="/login">Back to sign in</Link>
  </AuthCard>;
}
