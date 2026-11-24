/** Rupiah helpers. All money is whole rupiah (integers). */

const fmt = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

/** 48500 -> "Rp48.500" ; -1200 -> "-Rp1.200" */
export function rp(n: number): string {
  const v = Math.round(n);
  return (v < 0 ? "-Rp" : "Rp") + fmt.format(Math.abs(v));
}

/** Plain grouped number without the "Rp", for inputs: 48500 -> "48.500" */
export function groupDigits(n: number): string {
  return n ? fmt.format(Math.round(n)) : "";
}

/** Parse what people type ("48.500", "Rp 48,500", "48500") into rupiah. */
export function parseRp(s: string): number {
  const digits = s.replace(/[^\d]/g, "");
  if (!digits) return 0;
  return Math.min(Number(digits), 999_999_999);
}

/**
 * Split `total` (integer) across `weights` so the parts are integers that add
 * up to exactly `total`, staying as close as possible to the proportions.
 * Largest-remainder method.
 */
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + Math.max(0, b), 0);
  if (weights.length === 0) return [];
  if (sum <= 0) return weights.map(() => 0);
  const sign = total < 0 ? -1 : 1;
  const abs = Math.abs(Math.round(total));
  const raw = weights.map((w) => (Math.max(0, w) / sum) * abs);
  const parts = raw.map(Math.floor);
  let left = abs - parts.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) {
    parts[order[k].i] += 1;
  }
  return parts.map((p) => p * sign);
}
