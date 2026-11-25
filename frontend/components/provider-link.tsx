"use client";

import { useState } from "react";

export function ProviderLink({ href, children }: { href: string; children: string }) {
  const [loading, setLoading] = useState(false);
  return <a className="button-primary block w-full text-center" href={href} onClick={() => setLoading(true)} aria-busy={loading}>{loading ? "Connecting securely…" : children}</a>;
}
