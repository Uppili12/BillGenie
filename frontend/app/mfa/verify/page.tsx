import { AuthCard } from "../../../components/auth-card";

export default function MfaVerificationPage() {
  return <AuthCard title="Verify your sign-in" description="Complete the second factor requested by your organization identity provider.">
    <p className="rounded-md bg-slate-50 p-4 text-sm leading-6 text-slate-700">Enter authenticator or recovery credentials only on the identity provider’s sign-in page. Never enter a bank OTP, CVV, UPI PIN, or banking password here.</p>
    <a className="button-primary mt-5 block text-center" href="http://localhost:8080/realms/billgenie/account">Continue to identity provider</a>
  </AuthCard>;
}
