export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

export function formatValue(v: number | null): string {
  if (v === null) return "–";
  return Number.isInteger(v) ? v.toLocaleString("en-GB") : v.toLocaleString("en-GB", { maximumFractionDigits: 2 });
}

export function strokesLabel(strokes: number): string {
  if (strokes === 0) return "Hole in one!";
  return `${strokes} stroke${strokes === 1 ? "" : "s"}`;
}
