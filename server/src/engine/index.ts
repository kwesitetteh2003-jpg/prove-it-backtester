import { analyse } from "./analysis.js";
import { buyAndHold, simulate } from "./backtest.js";
import { computeBenchmark, computeMetrics, drawdownSeries } from "./metrics.js";
import { validateSpec } from "./spec.js";
import type { Candle, Report, StrategySpec } from "./types.js";

export * from "./types.js";
export { validateSpec, safeValidateSpec, specSchema } from "./spec.js";
export { simulate, buyAndHold } from "./backtest.js";
export * from "./indicators.js";
export * from "./metrics.js";

export interface RunOptions {
  dataset: Report["dataset"];
  barsPerYear: number;
}

const r2 = (x: number) => Math.round(x * 100) / 100;

export function runBacktest(specInput: unknown, candles: Candle[], opts: RunOptions): Report {
  const spec: StrategySpec = validateSpec(specInput);
  if (candles.length < 60) throw new Error("Need at least 60 bars of price data.");
  const t0 = performance.now();
  const sim = simulate(spec, candles);
  const bh = buyAndHold(spec, candles);
  const metrics = computeMetrics(sim.equity, sim.trades, spec.initialCapital, opts.barsPerYear, sim.feesPaid, sim.barsInMarket);
  const benchmarkMetrics = computeBenchmark(bh, spec.initialCapital, opts.barsPerYear);
  const analysis = analyse(spec, candles, sim.equity, bh, sim.trades, metrics, { barsPerYear: opts.barsPerYear, datasetKind: opts.dataset.kind });
  return {
    spec,
    dataset: { ...opts.dataset, bars: candles.length, from: candles[0]!.t, to: candles[candles.length - 1]!.t },
    times: candles.map((c) => c.t),
    equity: Array.from(sim.equity, r2),
    benchmark: Array.from(bh, r2),
    drawdown: Array.from(drawdownSeries(sim.equity), r2),
    benchmarkDrawdown: Array.from(drawdownSeries(bh), r2),
    trades: sim.trades,
    metrics,
    benchmarkMetrics,
    analysis,
    engineMs: Math.round(performance.now() - t0),
  };
}
