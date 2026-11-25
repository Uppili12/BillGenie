import type { ReactNode } from "react";

export function AuthCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <section className="panel mt-10 p-6 shadow-md sm:p-8"><a className="flex items-center gap-3" href="/"><span className="brand-mark" aria-hidden="true">B</span><span><span className="block text-lg font-semibold">BillGenie</span><span className="text-sm text-slate-500">AutomateGenie</span></span></a><h1 className="mt-8 text-2xl font-semibold tracking-tight">{title}</h1><p className="mt-2 text-sm leading-6 text-slate-600">{description}</p><div className="mt-6">{children}</div></section>;
}
