import { describe, expect, it } from "vitest";
import { ema, rsi, sma } from "../src/engine/indicators.js";
import { buyAndHold, simulate } from "../src/engine/backtest.js";
import { runBacktest } from "../src/engine/index.js";
import { safeValidateSpec } from "../src/engine/spec.js";
import { maxDrawdown } from "../src/engine/metrics.js";
import type { StrategySpec } from "../src/engine/types.js";
import { bars, buildFromTemplate, ds, walk, zeroCost } from "./helpers.js";

describe("indicators", () => {
  it("sma matches a hand calculation", () => {
    const s = sma([1, 2, 3, 4, 5], 3);
    expect(Number.isNaN(s[1])).toBe(true);
    expect([s[2], s[3], s[4]]).toEqual([2, 3, 4]);
  });
  it("ema seeds with the SMA and then smooths", () => {
    const e = ema([1, 2, 3, 4, 5], 3); // k = 0.5
    expect(e[2]).toBe(2);
    expect(e[3]).toBeCloseTo(3, 10);
    expect(e[4]).toBeCloseTo(4, 10);
  });
  it("rsi is 100 on a monotonic rise and 0 on a monotonic fall", () => {
    const up = rsi(Array.from({ length: 30 }, (_, i) => i + 1), 14);
    const down = rsi(Array.from({ length: 30 }, (_, i) => 100 - i), 14);
    expect(up[29]).toBe(100);
    expect(down[29]).toBeCloseTo(0, 6);
  });
});

describe("simulation", () => {
  const maSpec = (over: Partial<StrategySpec> = {}) => ({ ...buildFromTemplate("ma_cross", { fast: 2, slow: 3 }, { ...zeroCost }), ...over });

  it("fills at the NEXT bar's open, never at the signal bar's close", () => {
    // flat, then a jump that makes fast cross above slow on bar 5; bar 6 opens higher than bar 5 closed
    const closes = [10, 10, 10, 10, 10, 12, 14, 14, 14];
    const c = bars(closes);
    c[6]!.o = 13; // distinct open on the fill bar
    const r = simulate(maSpec({ exit: [], stopLossPct: 50 }), c);
    expect(r.trades.length).toBe(1);
    const t = r.trades[0]!;
    expect(t.entryIdx).toBe(6);
    expect(t.entryPrice).toBe(13);
  });

  it("charges fees and slippage on both sides", () => {
    const c = bars([10, 10, 10, 10, 10, 12, 14, 14, 10, 10, 10, 10]);
    const free = simulate(maSpec(), c);
    const costly = simulate({ ...maSpec(), feePct: 0.5, slippagePct: 0.5 }, c);
    expect(free.trades.length).toBeGreaterThan(0);
    expect(costly.equity.at(-1)!).toBeLessThan(free.equity.at(-1)!);
    expect(costly.feesPaid).toBeGreaterThan(0);
  });

  it("round trip with a known fee gives the exact equity", () => {
    // buy open 100, sell open 110, fee 1% per side, no slippage, 100% size, capital 10000
    const spec: StrategySpec = {
      name: "t", template: "custom", feePct: 1, slippagePct: 0, initialCapital: 10000, positionSizePct: 100,
      entry: [{ left: { kind: "indicator", name: "close" }, op: "above", right: { kind: "value", value: 0 } }],
      exit: [{ left: { kind: "indicator", name: "close" }, op: "above", right: { kind: "value", value: 105 } }],
    };
    const c2 = bars([100, 100, 100, 100, 110, 110, 110]);
    const r = simulate(spec, c2);
    // buys at bar1 open (100): q = 10000 / (100 * 1.01); sells at bar5 open (110)
    const q = 10000 / 101;
    const expected = q * 110 * 0.99 - 10000; // pnl of the first round trip
    expect(r.trades[0]!.entryIdx).toBe(1);
    expect(r.trades[0]!.exitIdx).toBe(5);
    expect(r.trades[0]!.pnl).toBeCloseTo(expected, 6);
  });

  it("stop-loss exits at the stop price intrabar, and at the open on a gap", () => {
    const base: StrategySpec = {
      name: "t", template: "custom", feePct: 0, slippagePct: 0, initialCapital: 1000, positionSizePct: 100, stopLossPct: 10,
      entry: [{ left: { kind: "indicator", name: "close" }, op: "above", right: { kind: "value", value: 0 } }], exit: [],
    };
    const c = bars([100, 100, 100, 100, 100]);
    c[3]!.l = 85; c[3]!.o = 100; // intrabar drop through the 90 stop
    const r = simulate(base, c);
    expect(r.trades[0]!.reason).toBe("stop_loss");
    expect(r.trades[0]!.exitPrice).toBeCloseTo(90, 8);
    const g = bars([100, 100, 100, 100, 100]);
    g[3]!.o = 80; g[3]!.l = 78; g[3]!.h = 81; g[3]!.c = 80;
    const r2 = simulate(base, g);
    expect(r2.trades[0]!.exitPrice).toBeCloseTo(80, 8); // gap: worse than the stop
  });

  it("assumes the stop hits first when stop and target both trigger in one bar", () => {
    const spec: StrategySpec = {
      name: "t", template: "custom", feePct: 0, slippagePct: 0, initialCapital: 1000, positionSizePct: 100, stopLossPct: 10, takeProfitPct: 10,
      entry: [{ left: { kind: "indicator", name: "close" }, op: "above", right: { kind: "value", value: 0 } }], exit: [],
    };
    const c = bars([100, 100, 100, 100]);
    c[2]!.h = 120; c[2]!.l = 80;
    expect(simulate(spec, c).trades[0]!.reason).toBe("stop_loss");
  });

  it("closes an open position at the last bar so equity is fully accounted", () => {
    const c = bars([10, 10, 10, 10, 10, 12, 14, 16, 18, 20]);
    const r = simulate(maSpec(), c);
    expect(r.trades.at(-1)!.reason).toBe("end_of_data");
  });

  it("buy & hold on the same data equals price ratio when costs are zero", () => {
    const c = bars(walk(100));
    const bh = buyAndHold(maSpec(), c);
    expect(bh.at(-1)! / bh[0]!).toBeCloseTo(c.at(-1)!.c / c[0]!.c, 8);
  });

  it("max drawdown is measured peak to trough", () => {
    expect(maxDrawdown([100, 150, 75, 100])).toBeCloseTo(-50, 8);
  });
});

describe("spec validation", () => {
  it("accepts a template-built spec", () => {
    expect(safeValidateSpec(buildFromTemplate("rsi_reversion", {})).ok).toBe(true);
  });
  it("rejects absurd periods, missing exits and unknown fields shapes", () => {
    const good = buildFromTemplate("ma_cross", {});
    expect(safeValidateSpec({ ...good, entry: [{ left: { kind: "indicator", name: "sma", period: 100000 }, op: "above", right: { kind: "value", value: 1 } }] }).ok).toBe(false);
    expect(safeValidateSpec({ ...good, exit: [] }).ok).toBe(false);
    expect(safeValidateSpec({ ...good, exit: [], stopLossPct: 5 }).ok).toBe(true);
    expect(safeValidateSpec({ ...good, feePct: -1 }).ok).toBe(false);
    expect(safeValidateSpec({ ...good, entry: [{ left: { kind: "indicator", name: "eval", period: 3 }, op: "above", right: { kind: "value", value: 1 } }] }).ok).toBe(false);
  });
});

describe("full report + honesty checks", () => {
  it("produces aligned series and a verdict", () => {
    const c = bars(walk(600, 9), { spread: 0.01 });
    const rep = runBacktest(buildFromTemplate("ma_cross", { fast: 5, slow: 20 }), c, { dataset: ds, barsPerYear: 365 });
    expect(rep.equity.length).toBe(600);
    expect(rep.benchmark.length).toBe(600);
    expect(rep.drawdown.every((d) => d <= 0)).toBe(true);
    expect(["not_credible", "inconclusive", "holds_up"]).toContain(rep.analysis.verdict.label);
    expect(rep.analysis.split).not.toBeNull();
    expect(rep.analysis.checks.some((x) => x.id === "lookahead")).toBe(true);
  });
  it("flags a strategy with very few trades", () => {
    const c = bars(walk(300, 3));
    const rep = runBacktest(buildFromTemplate("ma_cross", { fast: 40, slow: 120 }), c, { dataset: ds, barsPerYear: 365 });
    const sample = rep.analysis.checks.find((x) => x.id === "sample")!;
    expect(["fail", "warn"]).toContain(sample.status);
    expect(rep.analysis.verdict.label).not.toBe("holds_up");
  });
  it("flags synthetic data as a warning", () => {
    const c = bars(walk(400, 4));
    const rep = runBacktest(buildFromTemplate("breakout", {}), c, { dataset: { ...ds, kind: "synthetic" }, barsPerYear: 365 });
    expect(rep.analysis.checks.find((x) => x.id === "data")!.status).toBe("warn");
    expect(rep.analysis.verdict.label).not.toBe("holds_up");
  });
  it("is deterministic", () => {
    const c = bars(walk(500, 2));
    const spec = buildFromTemplate("rsi_reversion", {});
    const a = runBacktest(spec, c, { dataset: ds, barsPerYear: 365 });
    const b = runBacktest(spec, c, { dataset: ds, barsPerYear: 365 });
    expect(a.equity).toEqual(b.equity);
    expect(a.analysis.bootstrap).toEqual(b.analysis.bootstrap);
  });
});
