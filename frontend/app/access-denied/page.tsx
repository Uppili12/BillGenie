import Link from "next/link";
import { AuthCard } from "../../components/auth-card";

export default function AccessDeniedPage() {
  return <AuthCard title="Access denied" description="Your account does not have permission to view this resource. Access is checked by the BillGenie API."><Link className="button-primary block text-center" href="/">Return to overview</Link></AuthCard>;
}
