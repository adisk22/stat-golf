"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { AdminMe } from "@/lib/admin-types";
import { useApi } from "./use-api";
import { Notice } from "./ui";

const TABS = [
  { href: "/admin", label: "Questions" },
  { href: "/admin/schedule", label: "Schedule" },
  { href: "/admin/entities", label: "Entities" },
];

/**
 * Client-side gate for the admin pages. The real protection is server-side: every
 * /api/admin endpoint checks the session and is_admin, and RLS checks it again.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data: me, error } = useApi<AdminMe>("/api/admin/me");

  if (error || !me) {
    const signIn = `/login?next=${encodeURIComponent(pathname)}`;
    return (
      <>
        <div className="mx-auto max-w-md space-y-3 px-4 py-10">
          {!error ? (
            <p className="text-center text-zinc-500">Loading…</p>
          ) : (
            <>
              <Notice tone="error">{error}</Notice>
              {error.includes("Sign in") ? (
                <Link href={signIn} className="inline-block rounded-md bg-fairway-700 px-4 py-2 text-sm font-semibold text-white">
                  Sign in
                </Link>
              ) : (
                <p className="text-sm text-zinc-600">
                  Ask an existing admin to run the &ldquo;make admin&rdquo; SQL from the README for your email, then reload.
                </p>
              )}
            </>
          )}
        </div>
        {/* Keep the page mounted (Next validates that segments render); it stays hidden until access is confirmed. */}
        <div hidden>{children}</div>
      </>
    );
  }

  const active = (href: string) => (href === "/admin" ? pathname === "/admin" || pathname.startsWith("/admin/questions") : pathname.startsWith(href));
  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-2">
        <nav className="flex gap-1">
          {TABS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${active(t.href) ? "bg-fairway-700 text-white" : "text-zinc-700 hover:bg-zinc-100"}`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <form action="/auth/signout" method="post" className="flex items-center gap-2 text-xs text-zinc-500">
          <span>{me.email}</span>
          <button className="underline">Sign out</button>
        </form>
      </div>
      {children}
    </div>
  );
}
