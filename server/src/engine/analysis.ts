import { buyAndHold, simulate } from "./backtest.js";
import { computeMetrics, maxDrawdown } from "./metrics.js";
import type { Analysis, Candle, Check, Metrics, Operand, StrategySpec, Trade } from "./types.js";

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pct = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * sorted.length)))]!;
const fmt = (x: number, d = 1) => `${x >= 0 ? "+" : ""}${x.toFixed(d)}%`;

/** Every numeric knob in a spec, so we can nudge each by +-20-25% and see if the result survives. */
function perturbations(spec: StrategySpec): StrategySpec[] {
  const out: StrategySpec[] = [];
  const clone = () => JSON.parse(JSON.stringify(spec)) as StrategySpec;
  const slots: { get: (s: StrategySpec) => Operand | undefined }[] = [];
  (["entry", "exit"] as const).forEach((side) =>
    spec[side].forEach((_, ci) => (["left", "right"] as const).forEach((lr) => slots.push({ get: (s) => s[side][ci]?.[lr] }))),
  );
  for (const slot of slots) {
    const o = slot.get(spec);
    if (!o) continue;
    for (const f of [0.8, 1.25]) {
      const s = clone();
      const t = slot.get(s)!;
      if (t.kind === "indicator" && t.period !== undefined && t.name !== "close") {
        const np = Math.max(2, Math.round(t.period * f));
        if (np === t.period) continue;
        t.period = np;
      } else if (t.kind === "value") {
        if (t.value === 0) continue;
        t.value = +(t.value * f).toFixed(4);
      } else continue;
      out.push(s);
    }
  }
  for (const key of ["stopLossPct", "takeProfitPct"] as const) {
    if (spec[key] === undefined) continue;
    for (const f of [0.8, 1.25]) { const s = clone(); s[key] = +(spec[key]! * f).toFixed(2); out.push(s); }
  }
  return out;
}

function returnPct(eq: ArrayLike<number>, a: number, b: number) {
  return (eq[b]! / eq[a]! - 1) * 100;
}

export function analyse(
  spec: StrategySpec, candles: Candle[], eq: Float64Array, bh: Float64Array, trades: Trade[], metrics: Metrics,
  opts: { barsPerYear: number; datasetKind: "real" | "synthetic" | "custom" },
): Analysis {
  const checks: Check[] = [];
  const n = candles.length;
  const years = n / opts.barsPerYear;
  const bhRet = (bh[n - 1]! / spec.initialCapital - 1) * 100;

  // --- in-sample / out-of-sample consistency (same fixed rules, two periods) ---
  let split: Analysis["split"] = null;
  if (n >= 200) {
    const si = Math.floor(n * 0.7);
    split = {
      splitIdx: si, splitTime: candles[si]!.t,
      inSample: { returnPct: returnPct(eq, 0, si), benchmarkPct: returnPct(bh, 0, si) },
      outSample: { returnPct: returnPct(eq, si, n - 1), benchmarkPct: returnPct(bh, si, n - 1) },
    };
  }

  // --- parameter sensitivity ---
  let sensitivity: Analysis["sensitivity"] = null;
  const perts = perturbations(spec).slice(0, 24);
  if (perts.length) {
    const rets = perts.map((p) => {
      const r = simulate(p, candles);
      return (r.equity[n - 1]! / p.initialCapital - 1) * 100;
    }).sort((a, b) => a - b);
    sensitivity = {
      runs: rets.length,
      positiveShare: rets.filter((r) => r > 0).length / rets.length,
      medianReturnPct: rets[Math.floor(rets.length / 2)]!,
      worstReturnPct: rets[0]!,
      bestReturnPct: rets[rets.length - 1]!,
    };
  }

  // --- cost stress: double fees and slippage ---
  let costStress: Analysis["costStress"] = null;
  {
    const s2 = { ...spec, feePct: spec.feePct * 2, slippagePct: spec.slippagePct * 2 };
    const r = simulate(s2, candles);
    costStress = { multiple: 2, returnPct: (r.equity[n - 1]! / spec.initialCapital - 1) * 100 };
  }

  // --- bootstrap trade order / selection ---
  let bootstrap: Analysis["bootstrap"] = null;
  if (trades.length >= 8) {
    const rnd = mulberry32(1337);
    const weight = spec.positionSizePct / 100;
    const N = 500, dds: number[] = [], rets: number[] = [];
    for (let k = 0; k < N; k++) {
      let e = 1, peak = 1, mdd = 0;
      for (let j = 0; j < trades.length; j++) {
        const t = trades[Math.floor(rnd() * trades.length)]!;
        e *= 1 + (t.retPct / 100) * weight;
        peak = Math.max(peak, e);
        mdd = Math.min(mdd, e / peak - 1);
      }
      dds.push(mdd * 100); rets.push((e - 1) * 100);
    }
    dds.sort((a, b) => b - a); // least negative first
    rets.sort((a, b) => a - b);
    bootstrap = {
      samples: N,
      maxDrawdownP50: pct(dds, 0.5), maxDrawdownP95: pct(dds, 0.95),
      returnP5: pct(rets, 0.05), returnP50: pct(rets, 0.5), returnP95: pct(rets, 0.95),
    };
  }

  // =============== checks ===============
  checks.push({
    id: "lookahead", status: "pass", title: "No look-ahead",
    detail: "Signals are read at a bar's close and orders fill at the next bar's open. Highest/lowest windows exclude the current bar.",
  });

  if (opts.datasetKind === "synthetic") {
    checks.push({ id: "data", status: "warn", title: "Synthetic data", detail: "These prices are generated, not real. Results show how the rules behave in a made-up regime and say nothing about real markets." });
  } else if (opts.datasetKind === "custom") {
    checks.push({ id: "data", status: "info", title: "Your own data", detail: "Prove-It can't verify uploaded prices. Check for gaps, splits and survivorship bias yourself." });
  } else {
    checks.push({ id: "data", status: "info", title: "One market, one history", detail: "Real candles, but a single asset over a single path of history. A different path would have produced different results." });
  }

  const nt = trades.length;
  checks.push(
    nt < 10
      ? { id: "sample", status: "fail", title: `Only ${nt} trades`, detail: "Too few trades to separate skill from luck. Treat every number here as an anecdote." }
      : nt < 30
        ? { id: "sample", status: "warn", title: `Only ${nt} trades`, detail: "Under ~30 trades the win rate and averages are statistically weak." }
        : { id: "sample", status: "pass", title: `${nt} trades`, detail: "Enough trades for the averages to mean something, though not enough to prove an edge." },
  );

  checks.push(
    years < 1
      ? { id: "history", status: "fail", title: `${years.toFixed(1)} years of data`, detail: "Under a year of history covers at most one market regime." }
      : years < 2
        ? { id: "history", status: "warn", title: `${years.toFixed(1)} years of data`, detail: "A short window. Bull, bear and sideways phases probably aren't all in it." }
        : { id: "history", status: "pass", title: `${years.toFixed(1)} years of data`, detail: "A reasonable span, though it can still miss regimes." },
  );

  {
    const better = metrics.totalReturnPct > bhRet;
    const shallower = Math.abs(metrics.maxDrawdownPct) < 0.7 * Math.abs(maxDrawdown(bh));
    checks.push(
      better
        ? { id: "benchmark", status: "pass", title: "Beat buy-and-hold", detail: `Strategy ${fmt(metrics.totalReturnPct)} vs holding ${fmt(bhRet)} on the same data and costs.` }
        : shallower
          ? { id: "benchmark", status: "info", title: "Lagged buy-and-hold, but smoother", detail: `Strategy ${fmt(metrics.totalReturnPct)} vs holding ${fmt(bhRet)}, with a much shallower drawdown. That can be a fair trade if you value the smoother ride.` }
          : { id: "benchmark", status: "warn", title: "Buy-and-hold did better", detail: `Strategy ${fmt(metrics.totalReturnPct)} vs holding ${fmt(bhRet)}, without a meaningfully smaller drawdown. The complexity didn't pay.` },
    );
  }

  {
    const d = metrics.maxDrawdownPct;
    checks.push(
      d < -60
        ? { id: "drawdown", status: "fail", title: `${d.toFixed(0)}% max drawdown`, detail: "Few people can sit through a loss this deep without abandoning the strategy at the worst time." }
        : d < -35
          ? { id: "drawdown", status: "warn", title: `${d.toFixed(0)}% max drawdown`, detail: "A deep drawdown. Ask whether you'd really have held on." }
          : { id: "drawdown", status: "pass", title: `${d.toFixed(0)}% max drawdown`, detail: "Drawdown stayed within a range most people can stomach, on this history." },
    );
  }

  if (split) {
    const a = split.inSample.returnPct, b = split.outSample.returnPct;
    const when = `before ${split.splitTime.slice(0, 10)}`;
    checks.push(
      a > 0 && b <= 0
        ? { id: "oos", status: "fail", title: "Stopped working in the later period", detail: `Made ${fmt(a)} ${when} but ${fmt(b)} afterwards. A classic sign of a rule that fit the past.` }
        : a <= 0 && b > 0
          ? { id: "oos", status: "warn", title: "Only worked in the later period", detail: `${fmt(a)} ${when}, ${fmt(b)} afterwards. Inconsistent across time.` }
          : a <= 0 && b <= 0
            ? { id: "oos", status: "info", title: "Lost money in both periods", detail: `${fmt(a)} ${when} and ${fmt(b)} afterwards.` }
            : { id: "oos", status: "pass", title: "Profitable in both periods", detail: `${fmt(a)} ${when}, ${fmt(b)} afterwards. This is a consistency check on fixed rules, not a full walk-forward test.` },
    );
  }

  if (sensitivity) {
    const base = metrics.totalReturnPct;
    const fragile = base > 0 && (sensitivity.positiveShare < 0.5 || sensitivity.medianReturnPct < 0.5 * base);
    checks.push(
      base <= 0
        ? { id: "sensitivity", status: "info", title: "Parameter nudge test skipped", detail: "The base run doesn't make money, so there's no result to stress." }
        : sensitivity.positiveShare < 0.34
          ? { id: "sensitivity", status: "fail", title: "Result collapses when parameters move", detail: `Only ${(sensitivity.positiveShare * 100).toFixed(0)}% of ${sensitivity.runs} nearby settings (each number changed by 20-25%) made money. This looks like a lucky setting.` }
          : fragile
            ? { id: "sensitivity", status: "warn", title: "Sensitive to parameters", detail: `Median of ${sensitivity.runs} nearby settings: ${fmt(sensitivity.medianReturnPct)} vs ${fmt(base)} for yours. Range ${fmt(sensitivity.worstReturnPct)} to ${fmt(sensitivity.bestReturnPct)}.` }
            : { id: "sensitivity", status: "pass", title: "Stable under parameter nudges", detail: `${(sensitivity.positiveShare * 100).toFixed(0)}% of ${sensitivity.runs} nearby settings made money, median ${fmt(sensitivity.medianReturnPct)}.` },
    );
  }

  if (costStress) {
    const base = metrics.totalReturnPct;
    checks.push(
      base <= 0
        ? { id: "costs", status: "info", title: "Cost stress skipped", detail: "The base run is already unprofitable." }
        : costStress.returnPct <= 0
          ? { id: "costs", status: "fail", title: "Doubling costs erases the profit", detail: `${fmt(base)} at your fees vs ${fmt(costStress.returnPct)} at 2x fees and slippage. Real execution is often worse than an assumption.` }
          : costStress.returnPct < 0.5 * base
            ? { id: "costs", status: "warn", title: "Thin margin over costs", detail: `${fmt(base)} at your fees falls to ${fmt(costStress.returnPct)} at 2x fees and slippage.` }
            : { id: "costs", status: "pass", title: "Survives 2x trading costs", detail: `${fmt(base)} at your fees, ${fmt(costStress.returnPct)} at 2x fees and slippage.` },
    );
  }

  {
    const wins = trades.filter((t) => t.pnl > 0).map((t) => t.pnl).sort((a, b) => b - a);
    const gross = wins.reduce((s, x) => s + x, 0);
    if (wins.length >= 3 && gross > 0) {
      const top1 = wins[0]! / gross, top3 = (wins[0]! + wins[1]! + wins[2]!) / gross;
      checks.push(
        top1 > 0.5
          ? { id: "concentration", status: "warn", title: "One trade made most of the profit", detail: `The best trade is ${(top1 * 100).toFixed(0)}% of all gross profit. Remove it and the picture changes.` }
          : top3 > 0.8 && wins.length > 6
            ? { id: "concentration", status: "warn", title: "Three trades made most of the profit", detail: `The best three trades are ${(top3 * 100).toFixed(0)}% of gross profit.` }
            : { id: "concentration", status: "pass", title: "Profit is spread across trades", detail: `The best trade is ${(top1 * 100).toFixed(0)}% of gross profit.` },
      );
    }
  }

  if (bootstrap) {
    checks.push({
      id: "bootstrap", status: "info", title: "Luck of the draw",
      detail: `Resampling the same ${trades.length} trades ${bootstrap.samples} times, the middle outcome is ${fmt(bootstrap.returnP50, 0)} (5th-95th pct: ${fmt(bootstrap.returnP5, 0)} to ${fmt(bootstrap.returnP95, 0)}), and the max drawdown could plausibly reach ${bootstrap.maxDrawdownP95.toFixed(0)}%, not just the ${metrics.maxDrawdownPct.toFixed(0)}% seen.`,
    });
  }

  // =============== verdict ===============
  const fails = checks.filter((c) => c.status === "fail");
  const warns = checks.filter((c) => c.status === "warn");
  let label: Analysis["verdict"]["label"], headline: string;
  if (metrics.totalReturnPct <= 0) {
    label = "not_credible"; headline = "This strategy loses money on this data.";
  } else if (fails.length) {
    label = "not_credible"; headline = "The profit doesn't survive scrutiny.";
  } else if (warns.length >= 2 || (warns.length === 1 && warns[0]!.id !== "data")) {
    label = "inconclusive"; headline = "Promising on paper, but not convincing.";
  } else if (warns.length === 1) {
    label = "inconclusive"; headline = "Passes the checks, but the data limits what that means.";
  } else {
    label = "holds_up"; headline = "Holds up against every check we run. That is still not proof.";
  }
  const reasons = [...fails, ...warns].map((c) => c.title);
  return { checks, verdict: { label, headline, reasons }, split, sensitivity, costStress, bootstrap };
}

export { computeMetrics, buyAndHold };
