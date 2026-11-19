/** Placeholder crest/flag: initials on a colour derived from the name (no real logos). */
const PALETTE = ["#166534", "#1d4ed8", "#9f1239", "#7c2d12", "#5b21b6", "#0f766e", "#a16207", "#334155"];

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export function EntityBadge({ name, size = 28 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter((w) => /^\p{L}/u.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.4, background: PALETTE[hash(name) % PALETTE.length] }}
    >
      {initials || "?"}
    </span>
  );
}
