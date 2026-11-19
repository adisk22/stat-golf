"use client";
import Link from "next/link";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const control =
  "w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-fairway-600 focus:ring-2 focus:ring-fairway-200 disabled:bg-zinc-100";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${control} ${props.className ?? ""}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${control} ${props.className ?? ""}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${control} font-mono ${props.className ?? ""}`} />;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  // The hint sits outside <label> so it isn't part of the control's accessible name.
  return (
    <div className="space-y-1">
      <label className="block space-y-1">
        <span className="text-sm font-medium text-zinc-800">{label}</span>
        {children}
      </label>
      {hint && <p className="text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

type Variant = "primary" | "secondary" | "danger" | "ghost";
const variants: Record<Variant, string> = {
  primary: "bg-fairway-700 text-white hover:bg-fairway-800 disabled:bg-zinc-300",
  secondary: "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 disabled:text-zinc-400",
  danger: "border border-red-300 bg-white text-red-700 hover:bg-red-50 disabled:text-zinc-400",
  ghost: "text-zinc-600 hover:bg-zinc-100 disabled:text-zinc-300",
};

export function Button({ variant = "primary", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed ${variants[variant]} ${props.className ?? ""}`}
    />
  );
}

export function Card({ title, actions, children }: { title?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="font-semibold text-zinc-900">{title}</h2>}
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Notice({ tone, children }: { tone: "error" | "warning" | "success" | "info"; children: ReactNode }) {
  const tones = {
    error: "border-red-200 bg-red-50 text-red-800",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    success: "border-fairway-200 bg-fairway-50 text-fairway-800",
    info: "border-zinc-200 bg-zinc-50 text-zinc-700",
  };
  return (
    <div className={`rounded-md border px-3 py-2 text-sm ${tones[tone]}`} role={tone === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}

export function IssueList({ tone, items }: { tone: "error" | "warning"; items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <Notice tone={tone}>
      <ul className="list-disc space-y-0.5 pl-4">
        {items.map((m, i) => (
          <li key={i}>{m}</li>
        ))}
      </ul>
    </Notice>
  );
}

export function Badge({ tone, children, testId }: { tone: "green" | "amber" | "red" | "zinc" | "blue"; children: ReactNode; testId?: string }) {
  const tones = {
    green: "bg-fairway-100 text-fairway-800",
    amber: "bg-amber-100 text-amber-900",
    red: "bg-red-100 text-red-800",
    zinc: "bg-zinc-100 text-zinc-700",
    blue: "bg-sky-100 text-sky-800",
  };
  return (
    <span data-testid={testId} className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-sm text-fairway-700 hover:underline">
      ← {children}
    </Link>
  );
}
