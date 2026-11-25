import Link from "next/link";
import { AuthCard } from "../../components/auth-card";

export default function ResetPasswordPage() {
  return <AuthCard title="Choose a new password" description="Use the single-use, expiring reset link sent by your verified identity provider.">
    <p className="rounded-md bg-slate-50 p-4 text-sm leading-6 text-slate-700">BillGenie does not accept passwords or reset tokens. Open the provider link from your email to complete the reset.</p>
    <Link className="button-primary mt-5 block text-center" href="/forgot-password">Request a reset link</Link>
  </AuthCard>;
}
