import { operandSeries, type Series } from "./indicators.js";
import type { Candle, Condition, StrategySpec, Trade } from "./types.js";

export interface SimResult {
  equity: Float64Array;
  trades: Trade[];
  feesPaid: number;
  barsInMarket: number;
}

function compileConditions(conds: Condition[], candles: Candle[]) {
  const cache = new Map<string, Series>();
  return conds.map((c) => ({ op: c.op, l: operandSeries(c.left, candles, cache), r: operandSeries(c.right, candles, cache) }));
}

type Compiled = ReturnType<typeof compileConditions>[number];

function holds(c: Compiled, i: number): boolean {
  const l = c.l[i]!, r = c.r[i]!;
  if (Number.isNaN(l) || Number.isNaN(r)) return false;
  switch (c.op) {
    case "above": return l > r;
    case "below": return l < r;
    case "crosses_above": {
      if (i === 0) return false;
      const pl = c.l[i - 1]!, pr = c.r[i - 1]!;
      return !Number.isNaN(pl) && !Number.isNaN(pr) && pl <= pr && l > r;
    }
    case "crosses_below": {
      if (i === 0) return false;
      const pl = c.l[i - 1]!, pr = c.r[i - 1]!;
      return !Number.isNaN(pl) && !Number.isNaN(pr) && pl >= pr && l < r;
    }
  }
}

/**
 * Long-only, no leverage, one position at a time.
 * Signals are evaluated on a bar's CLOSE; orders fill at the NEXT bar's OPEN
 * (no look-ahead). Stops / take-profits are checked against intrabar high/low
 * and, when both could have triggered in one bar, the stop is assumed to hit first.
 * Fees and slippage are charged on every fill.
 */
export function simulate(spec: StrategySpec, candles: Candle[]): SimResult {
  const n = candles.length;
  const entry = compileConditions(spec.entry, candles);
  const exit = compileConditions(spec.exit, candles);
  const fee = spec.feePct / 100, slip = spec.slippagePct / 100;
  const sl = spec.stopLossPct !== undefined ? spec.stopLossPct / 100 : undefined;
  const tp = spec.takeProfitPct !== undefined ? spec.takeProfitPct / 100 : undefined;

  let cash = spec.initialCapital;
  let qty = 0, entryPrice = 0, entryIdx = -1, entryCost = 0;
  let pending: "buy" | "sell" | null = null;
  let feesPaid = 0, barsInMarket = 0;
  const equity = new Float64Array(n);
  const trades: Trade[] = [];

  const closePosition = (i: number, rawPrice: number, reason: Trade["reason"]) => {
    const px = rawPrice * (1 - slip);
    const notional = qty * px;
    const f = notional * fee;
    cash += notional - f;
    feesPaid += f;
    const pnl = notional - f - entryCost;
    trades.push({
      entryIdx, exitIdx: i,
      entryTime: candles[entryIdx]!.t, exitTime: candles[i]!.t,
      entryPrice, exitPrice: px, qty, pnl,
      retPct: (pnl / entryCost) * 100,
      bars: i - entryIdx, reason,
    });
    qty = 0; entryIdx = -1;
  };

  for (let i = 0; i < n; i++) {
    const bar = candles[i]!;

    // 1) fill orders decided on the previous close at this bar's open
    if (pending === "buy" && qty === 0) {
      const px = bar.o * (1 + slip);
      const equityNow = cash;
      const budget = equityNow * (spec.positionSizePct / 100);
      const q = budget / (px * (1 + fee));
      const notional = q * px;
      const f = notional * fee;
      cash -= notional + f;
      feesPaid += f;
      qty = q; entryPrice = px; entryIdx = i; entryCost = notional + f;
    } else if (pending === "sell" && qty > 0) {
      closePosition(i, bar.o, "signal");
    }
    pending = null;

    // 2) protective exits inside the bar
    if (qty > 0) {
      const stop = sl !== undefined ? entryPrice * (1 - sl) : undefined;
      const target = tp !== undefined ? entryPrice * (1 + tp) : undefined;
      if (stop !== undefined && bar.o <= stop) closePosition(i, bar.o, "stop_loss");
      else if (stop !== undefined && bar.l <= stop) closePosition(i, stop, "stop_loss");
      else if (target !== undefined && bar.o >= target) closePosition(i, bar.o, "take_profit");
      else if (target !== undefined && bar.h >= target) closePosition(i, target, "take_profit");
    }

    // 3) mark to market at the close
    if (qty > 0) barsInMarket++;
    equity[i] = cash + qty * bar.c;

    // 4) look at the close for tomorrow's order
    if (i < n - 1) {
      if (qty === 0) {
        if (entry.every((c) => holds(c, i))) pending = "buy";
      } else if (exit.length > 0 && exit.some((c) => holds(c, i))) {
        pending = "sell";
      }
    }
  }

  if (qty > 0) {
    // Close the final open position at the last close so every trade is accounted for.
    const last = candles[n - 1]!;
    closePosition(n - 1, last.c, "end_of_data");
    equity[n - 1] = cash;
  }
  return { equity, trades, feesPaid, barsInMarket };
}

/** Buy & hold benchmark: buy the first bar's open (same fee + slippage), hold to the end. */
export function buyAndHold(spec: StrategySpec, candles: Candle[]): Float64Array {
  const fee = spec.feePct / 100, slip = spec.slippagePct / 100;
  const px = candles[0]!.o * (1 + slip);
  const q = spec.initialCapital / (px * (1 + fee));
  const out = new Float64Array(candles.length);
  for (let i = 0; i < candles.length; i++) out[i] = q * candles[i]!.c;
  return out;
}
