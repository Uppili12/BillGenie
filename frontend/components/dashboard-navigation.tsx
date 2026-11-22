"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { sections } from "../lib/sections";

export function DashboardNavigation() {
  const pathname = usePathname();

  return <DashboardLinks pathname={pathname} />;
}

export function DashboardLinks({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Dashboard" className="mt-5 lg:mt-9">
      <ul className="grid grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-1">
        {sections.map(({ href, label }) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={href === pathname ? "page" : undefined}
              className="nav-link"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
