import type { BenchmarkMetrics, Metrics, Trade } from "./types.js";

export function drawdownSeries(eq: ArrayLike<number>): Float64Array {
  const out = new Float64Array(eq.length);
  let peak = -Infinity;
  for (let i = 0; i < eq.length; i++) {
    peak = Math.max(peak, eq[i]!);
    out[i] = (eq[i]! / peak - 1) * 100;
  }
  return out;
}

export const maxDrawdown = (eq: ArrayLike<number>) => {
  const dd = drawdownSeries(eq);
  let m = 0;
  for (const d of dd) if (d < m) m = d;
  return m;
};

function returns(eq: ArrayLike<number>): number[] {
  const r: number[] = [];
  for (let i = 1; i < eq.length; i++) r.push(eq[i]! / eq[i - 1]! - 1);
  return r;
}
const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const std = (a: number[]) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
};

export function sharpe(eq: ArrayLike<number>, barsPerYear: number): number {
  const r = returns(eq), s = std(r);
  return s === 0 ? 0 : (mean(r) / s) * Math.sqrt(barsPerYear);
}

export function sortino(eq: ArrayLike<number>, barsPerYear: number): number {
  const r = returns(eq);
  const down = r.filter((x) => x < 0);
  const dd = Math.sqrt(down.reduce((s, x) => s + x * x, 0) / Math.max(1, r.length));
  return dd === 0 ? 0 : (mean(r) / dd) * Math.sqrt(barsPerYear);
}

export function cagr(start: number, end: number, bars: number, barsPerYear: number): number {
  const years = bars / barsPerYear;
  if (years <= 0 || start <= 0 || end <= 0) return end <= 0 ? -100 : 0;
  return (Math.pow(end / start, 1 / years) - 1) * 100;
}

export function computeMetrics(
  eq: ArrayLike<number>, trades: Trade[], initial: number, barsPerYear: number, feesPaid: number, barsInMarket: number,
): Metrics {
  const final = eq[eq.length - 1]!;
  const wins = trades.filter((t) => t.pnl > 0);
  const grossWin = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = trades.filter((t) => t.pnl <= 0).reduce((s, t) => s - t.pnl, 0);
  const mdd = maxDrawdown(eq);
  const c = cagr(initial, final, eq.length, barsPerYear);
  return {
    finalEquity: final,
    totalReturnPct: (final / initial - 1) * 100,
    cagrPct: c,
    maxDrawdownPct: mdd,
    sharpe: sharpe(eq, barsPerYear),
    sortino: sortino(eq, barsPerYear),
    calmar: mdd === 0 ? 0 : c / Math.abs(mdd),
    trades: trades.length,
    winRatePct: trades.length ? (wins.length / trades.length) * 100 : 0,
    profitFactor: grossLoss === 0 ? (grossWin > 0 ? 99 : 0) : grossWin / grossLoss,
    avgTradePct: mean(trades.map((t) => t.retPct)),
    avgBarsHeld: mean(trades.map((t) => t.bars)),
    exposurePct: (barsInMarket / eq.length) * 100,
    feesPaid,
  };
}

export function computeBenchmark(eq: ArrayLike<number>, initial: number, barsPerYear: number): BenchmarkMetrics {
  const final = eq[eq.length - 1]!;
  return {
    finalEquity: final,
    totalReturnPct: (final / initial - 1) * 100,
    cagrPct: cagr(initial, final, eq.length, barsPerYear),
    maxDrawdownPct: maxDrawdown(eq),
    sharpe: sharpe(eq, barsPerYear),
  };
}
