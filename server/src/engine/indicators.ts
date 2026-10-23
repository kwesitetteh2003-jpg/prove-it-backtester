import type { Candle, Operand } from "./types.js";

export type Series = Float64Array;
const nan = (n: number): Series => new Float64Array(n).fill(NaN);

export function sma(x: ArrayLike<number>, p: number): Series {
  const n = x.length, out = nan(n);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += x[i]!;
    if (i >= p) sum -= x[i - p]!;
    if (i >= p - 1) out[i] = sum / p;
  }
  return out;
}

export function ema(x: ArrayLike<number>, p: number): Series {
  const n = x.length, out = nan(n);
  if (n < p) return out;
  const k = 2 / (p + 1);
  let prev = 0;
  for (let i = 0; i < p; i++) prev += x[i]!;
  prev /= p;
  out[p - 1] = prev;
  for (let i = p; i < n; i++) {
    prev = x[i]! * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** Wilder's RSI. */
export function rsi(x: ArrayLike<number>, p: number): Series {
  const n = x.length, out = nan(n);
  if (n <= p) return out;
  let gain = 0, loss = 0;
  for (let i = 1; i <= p; i++) {
    const d = x[i]! - x[i - 1]!;
    if (d >= 0) gain += d; else loss -= d;
  }
  gain /= p; loss /= p;
  out[p] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = p + 1; i < n; i++) {
    const d = x[i]! - x[i - 1]!;
    gain = (gain * (p - 1) + (d > 0 ? d : 0)) / p;
    loss = (loss * (p - 1) + (d < 0 ? -d : 0)) / p;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

/** Highest HIGH of the previous p bars, excluding the current bar (no look-ahead). */
export function highestPrev(h: ArrayLike<number>, p: number): Series {
  const n = h.length, out = nan(n);
  for (let i = p; i < n; i++) {
    let m = -Infinity;
    for (let j = i - p; j < i; j++) if (h[j]! > m) m = h[j]!;
    out[i] = m;
  }
  return out;
}

export function lowestPrev(l: ArrayLike<number>, p: number): Series {
  const n = l.length, out = nan(n);
  for (let i = p; i < n; i++) {
    let m = Infinity;
    for (let j = i - p; j < i; j++) if (l[j]! < m) m = l[j]!;
    out[i] = m;
  }
  return out;
}

export function operandSeries(o: Operand, candles: Candle[], cache: Map<string, Series>): Series {
  const n = candles.length;
  if (o.kind === "value") return new Float64Array(n).fill(o.value);
  const key = `${o.name}:${o.period ?? 0}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const close = candles.map((c) => c.c);
  let s: Series;
  switch (o.name) {
    case "close": s = Float64Array.from(close); break;
    case "sma": s = sma(close, o.period!); break;
    case "ema": s = ema(close, o.period!); break;
    case "rsi": s = rsi(close, o.period!); break;
    case "highest": s = highestPrev(candles.map((c) => c.h), o.period!); break;
    case "lowest": s = lowestPrev(candles.map((c) => c.l), o.period!); break;
  }
  cache.set(key, s);
  return s;
}
