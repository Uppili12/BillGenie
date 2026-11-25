import Link from "next/link";
import { AuthCard } from "../../components/auth-card";
import { apiOriginForBrowser } from "../../lib/api-origin";
import { ProviderLink } from "../../components/provider-link";

type Search = Promise<{ invite?: string; error?: string }>;

export default async function LoginPage({ searchParams }: { searchParams?: Search }) {
  const search = await searchParams ?? {};
  const href = new URL("/auth/login", apiOriginForBrowser);
  if (search.invite && /^[A-Za-z0-9_-]{32,128}$/.test(search.invite)) href.searchParams.set("invite", search.invite);
  return <AuthCard title="Sign in securely" description="BillGenie uses your organization identity provider for sign-in. Passwords and MFA codes are entered only on that provider’s verified sign-in page.">
    {search.error === "signin_failed" && <p role="alert" className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800">We couldn’t sign you in. Check your account access and try again.</p>}
    <ProviderLink href={href.toString()}>Continue to secure sign-in</ProviderLink>
    <p className="mt-4 text-sm text-slate-600">Sign-in requires an invitation and a verified work email. There is no public registration.</p>
    <nav aria-label="Account help" className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm"><Link className="text-sky-800 underline" href="/forgot-password">Forgot password</Link><Link className="text-sky-800 underline" href="/account-recovery">Account recovery</Link></nav>
  </AuthCard>;
}
