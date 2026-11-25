import Link from "next/link";
import { AuthCard } from "../../../components/auth-card";

export default function MfaEnrollmentPage() {
  return <AuthCard title="Set up multi-factor authentication" description="Authenticator app setup and supported passkeys are managed by your organization identity provider.">
    <p className="rounded-md bg-slate-50 p-4 text-sm leading-6 text-slate-700">Administrator and CEO accounts require MFA. The provider guides enrollment and recovery; BillGenie never asks for banking OTPs or payment credentials.</p>
    <a className="button-primary mt-5 block text-center" href="http://localhost:8080/realms/billgenie/account">Open MFA settings</a>
    <Link className="mt-5 inline-block text-sm text-sky-800 underline" href="/account">Back to my account</Link>
  </AuthCard>;
}
