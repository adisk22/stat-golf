import { Suspense, type ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";

// Admin pages depend on the session, so they can't be part of a prerendered shell.
export const instant = false;

export default function AdminLayout({ children }: { children: ReactNode }) {
  // Admin pages are client-rendered (they read the clock and the session); Suspense lets
  // the static shell render without them.
  return (
    <Suspense fallback={<p className="px-4 py-10 text-center text-zinc-500">Loading…</p>}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
