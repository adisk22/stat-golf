"use client";
import { useCallback, useEffect, useState } from "react";
import { publicEnv } from "@/lib/env";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export type SessionStatus = "loading" | "needs-captcha" | "ready" | "error";

/**
 * Ensures there is a Supabase session, signing in anonymously when needed.
 * With a Turnstile site key configured, anonymous sign-in waits for a CAPTCHA token.
 */
export function useSession() {
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const siteKey = publicEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const signInAnonymously = useCallback(async (captchaToken?: string) => {
    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signInAnonymously(captchaToken ? { options: { captchaToken } } : undefined);
    if (error) {
      setError(error.message);
      setStatus("error");
    } else {
      setStatus("ready");
    }
  }, []);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setStatus("ready");
      else if (siteKey) setStatus("needs-captcha");
      else void signInAnonymously();
    });
  }, [siteKey, signInAnonymously]);

  const onCaptchaToken = useCallback((token: string) => void signInAnonymously(token), [signInAnonymously]);
  const onCaptchaError = useCallback(() => {
    setError("Couldn't verify you're human. Refresh to try again.");
    setStatus("error");
  }, []);

  return { status, error, siteKey, onCaptchaToken, onCaptchaError };
}
