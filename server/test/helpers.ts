import type { Candle } from "../src/engine/types.js";
import { buildFromTemplate } from "../src/engine/templates.js";

export function bars(closes: number[], opts: { spread?: number } = {}): Candle[] {
  const s = opts.spread ?? 0;
  return closes.map((c, i) => {
    const o = i === 0 ? c : closes[i - 1]!;
    return { t: new Date(Date.UTC(2022, 0, 1 + i)).toISOString().slice(0, 10), o, h: Math.max(o, c) * (1 + s), l: Math.min(o, c) * (1 - s), c, v: 1000 };
  });
}
export const zeroCost = { feePct: 0, slippagePct: 0 };
export const ds = { id: "t", name: "test", kind: "real" as const, source: "test", bars: 0, from: "", to: "" };

export function walk(n: number, seed = 5): number[] {
  let s = seed, p = 100; const out: number[] = [];
  for (let i = 0; i < n; i++) { s = (s * 1664525 + 1013904223) % 4294967296; p *= 1 + ((s / 4294967296) - 0.5) * 0.04; out.push(p); }
  return out;
}
export { buildFromTemplate };
