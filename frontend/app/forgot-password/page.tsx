import Link from "next/link";
import { AuthCard } from "../../components/auth-card";

export default function ForgotPasswordPage() {
  return <AuthCard title="Reset your password" description="Password recovery is handled by your organization identity provider. BillGenie never receives or stores your password.">
    <p className="rounded-md bg-slate-50 p-4 text-sm leading-6 text-slate-700">Continue to the identity provider’s account console to request a verified email reset link. Responses there are designed to avoid confirming whether an account exists.</p>
    <a className="button-primary mt-5 block text-center" href="http://localhost:8080/realms/billgenie/account">Open secure account recovery</a>
    <Link className="mt-5 inline-block text-sm text-sky-800 underline" href="/login">Back to sign in</Link>
  </AuthCard>;
}
