"use client";
import { useEffect, useRef } from "react";

interface TurnstileApi {
  render: (el: HTMLElement, opts: { sitekey: string; callback: (token: string) => void; "error-callback"?: () => void; appearance?: string }) => string;
  remove: (id: string) => void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadScript(): Promise<TurnstileApi> {
  return new Promise((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile);
    let s = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (!s) {
      s = document.createElement("script");
      s.src = SCRIPT_SRC;
      s.async = true;
      document.head.appendChild(s);
    }
    s.addEventListener("load", () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile failed to load"))));
    s.addEventListener("error", () => reject(new Error("Turnstile failed to load")));
  });
}

/** Cloudflare Turnstile widget; calls onToken once the visitor passes. Usually invisible. */
export function Turnstile({ siteKey, onToken, onError }: { siteKey: string; onToken: (t: string) => void; onError: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let id: string | undefined;
    let cancelled = false;
    loadScript()
      .then((t) => {
        if (cancelled || !ref.current) return;
        id = t.render(ref.current, { sitekey: siteKey, callback: onToken, "error-callback": onError, appearance: "interaction-only" });
      })
      .catch(onError);
    return () => {
      cancelled = true;
      if (id) window.turnstile?.remove(id);
    };
  }, [siteKey, onToken, onError]);
  return <div ref={ref} className="flex justify-center" />;
}
