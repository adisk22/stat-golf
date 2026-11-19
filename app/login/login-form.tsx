"use client";
import { useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Turnstile } from "@/components/game/turnstile";
import { publicEnv } from "@/lib/env";
import { safeNext } from "@/lib/safe-next";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function LoginForm() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const siteKey = publicEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const [email, setEmail] = useState("");
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(params.get("error") ? "That sign-in link is invalid or expired. Request a new one." : null);

  const onToken = useCallback((t: string) => setCaptcha(t), []);
  const onCaptchaError = useCallback(() => setError("CAPTCHA failed to load. Refresh and try again."), []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        captchaToken: captcha ?? undefined,
      },
    });
    if (error) {
      setError(error.message);
      setStatus("idle");
    } else {
      setStatus("sent");
    }
  }

  if (status === "sent") {
    return (
      <div className="space-y-2 rounded-xl border border-fairway-200 bg-white p-6 text-center shadow-sm" role="status">
        <h1 className="text-xl font-semibold">Check your email</h1>
        <p className="text-sm text-zinc-600">
          We sent a sign-in link to <strong>{email}</strong>. Open it on this device.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div>
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="text-sm text-zinc-600">We&apos;ll email you a one-time link. No password needed.</p>
      </div>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 outline-none focus:border-fairway-600 focus:ring-2 focus:ring-fairway-200"
        />
      </label>
      {siteKey && <Turnstile siteKey={siteKey} onToken={onToken} onError={onCaptchaError} />}
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <button
        type="submit"
        disabled={status === "sending" || (Boolean(siteKey) && !captcha)}
        className="w-full rounded-lg bg-fairway-700 px-4 py-2.5 font-semibold text-white hover:bg-fairway-800 disabled:bg-zinc-300"
      >
        {status === "sending" ? "Sending…" : "Email me a link"}
      </button>
    </form>
  );
}
