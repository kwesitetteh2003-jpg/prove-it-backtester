import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Candle } from "./engine/types.js";

export interface DatasetMeta {
  id: string; name: string; blurb: string; kind: "real" | "synthetic"; source: string; barsPerYear: number; file: string;
}
export interface DatasetInfo extends Omit<DatasetMeta, "file"> { bars: number; from: string; to: string; spark: number[]; firstClose: number; lastClose: number }

const here = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.DATA_DIR ? resolve(process.env.DATA_DIR) : resolve(here, "../../data");

export function parseCsv(text: string, maxRows = 20000): Candle[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error("CSV needs a header and at least one row.");
  const head = lines[0]!.toLowerCase().split(",").map((h) => h.trim());
  const idx = (names: string[]) => head.findIndex((h) => names.includes(h));
  const ti = idx(["time", "date", "timestamp", "datetime"]), oi = idx(["open", "o"]), hi = idx(["high", "h"]), li = idx(["low", "l"]), ci = idx(["close", "c", "adj close"]), vi = idx(["volume", "v"]);
  if ([ti, oi, hi, li, ci].some((i) => i < 0)) throw new Error("CSV header must include time, open, high, low, close (volume optional).");
  if (lines.length - 1 > maxRows) throw new Error(`Too many rows (max ${maxRows}).`);
  const out: Candle[] = [];
  for (let k = 1; k < lines.length; k++) {
    const f = lines[k]!.split(",");
    if (f.length < head.length - (vi < 0 ? 0 : 1)) continue;
    const rawT = f[ti]!.trim();
    const t = /^\d{10,13}$/.test(rawT) ? new Date(rawT.length === 10 ? +rawT * 1000 : +rawT).toISOString() : rawT;
    const o = +f[oi]!, h = +f[hi]!, l = +f[li]!, c = +f[ci]!, v = vi >= 0 ? +f[vi]! : 0;
    if (![o, h, l, c].every((x) => Number.isFinite(x) && x > 0)) throw new Error(`Row ${k + 1}: prices must be positive numbers.`);
    if (h < Math.max(o, c) - 1e-9 || l > Math.min(o, c) + 1e-9) throw new Error(`Row ${k + 1}: high/low inconsistent with open/close.`);
    out.push({ t, o, h, l, c, v: Number.isFinite(v) ? v : 0 });
  }
  for (let i = 1; i < out.length; i++) if (!(out[i]!.t > out[i - 1]!.t)) throw new Error(`Row ${i + 2}: timestamps must be strictly increasing.`);
  return out;
}

/** Guess bars per year from the median gap between bars. */
export function inferBarsPerYear(c: Candle[]): number {
  if (c.length < 3) return 365;
  const gaps: number[] = [];
  for (let i = 1; i < Math.min(c.length, 200); i++) gaps.push((Date.parse(c[i]!.t) - Date.parse(c[i - 1]!.t)) / 3600000);
  gaps.sort((a, b) => a - b);
  const h = gaps[Math.floor(gaps.length / 2)]!;
  if (!Number.isFinite(h) || h <= 0) return 252;
  if (h >= 24 * 6) return 52;
  if (h >= 20) return 365;
  return Math.round(8760 / h);
}

let cache: { metas: DatasetMeta[]; candles: Map<string, Candle[]> } | null = null;
function load() {
  if (cache) return cache;
  const metas: DatasetMeta[] = [];
  for (const f of ["real.meta.json", "synthetic.meta.json"]) {
    const p = join(DATA_DIR, f);
    if (existsSync(p)) metas.push(...(JSON.parse(readFileSync(p, "utf8")) as DatasetMeta[]));
  }
  cache = { metas, candles: new Map() };
  return cache;
}

export function getDatasetMeta(id: string) { return load().metas.find((m) => m.id === id); }
export function getCandles(id: string): Candle[] | undefined {
  const c = load();
  const meta = c.metas.find((m) => m.id === id);
  if (!meta) return undefined;
  let candles = c.candles.get(id);
  if (!candles) { candles = parseCsv(readFileSync(join(DATA_DIR, meta.file), "utf8")); c.candles.set(id, candles); }
  return candles;
}

export function listDatasets(): DatasetInfo[] {
  return load().metas.map((m) => {
    const c = getCandles(m.id)!;
    const step = Math.max(1, Math.floor(c.length / 48));
    const spark = c.filter((_, i) => i % step === 0).map((x) => x.c);
    const { file: _f, ...rest } = m;
    return { ...rest, bars: c.length, from: c[0]!.t, to: c[c.length - 1]!.t, spark, firstClose: c[0]!.c, lastClose: c[c.length - 1]!.c };
  });
}
