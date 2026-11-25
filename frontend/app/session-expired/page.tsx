import Link from "next/link";
import { AuthCard } from "../../components/auth-card";

export default function SessionExpiredPage() {
  return <AuthCard title="Your session has expired" description="For your security, BillGenie ended this session. Sign in again to continue."><Link className="button-primary block text-center" href="/login">Sign in again</Link></AuthCard>;
}
