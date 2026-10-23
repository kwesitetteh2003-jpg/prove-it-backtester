import type { StrategySpec, Template } from "./types.js";

export interface CommonParams {
  feePct: number;
  slippagePct: number;
  initialCapital: number;
  positionSizePct: number;
  stopLossPct?: number;
  takeProfitPct?: number;
}

export const DEFAULT_COMMON: CommonParams = { feePct: 0.1, slippagePct: 0.05, initialCapital: 10000, positionSizePct: 100 };

export interface TemplateParams {
  ma_cross: { fast: number; slow: number; kind: "sma" | "ema" };
  rsi_reversion: { period: number; oversold: number; overbought: number };
  breakout: { lookback: number; exitLookback: number };
}

export const DEFAULT_PARAMS: TemplateParams = {
  ma_cross: { fast: 20, slow: 50, kind: "sma" },
  rsi_reversion: { period: 14, oversold: 30, overbought: 55 },
  breakout: { lookback: 20, exitLookback: 10 },
};

export const TEMPLATE_INFO: Record<Exclude<Template, "custom">, { label: string; tagline: string }> = {
  ma_cross: { label: "Moving-average crossover", tagline: "Ride trends: buy when a fast average crosses above a slow one." },
  rsi_reversion: { label: "RSI mean reversion", tagline: "Buy dips: enter when RSI is oversold, exit when it recovers." },
  breakout: { label: "Channel breakout", tagline: "Buy strength: enter on a new N-bar high, exit on a pullback." },
};

export function buildFromTemplate(
  template: Exclude<Template, "custom">, params: Record<string, unknown> | undefined, common: Partial<CommonParams> = {},
): StrategySpec {
  const c = { ...DEFAULT_COMMON, ...common };
  const base = { feePct: c.feePct, slippagePct: c.slippagePct, initialCapital: c.initialCapital, positionSizePct: c.positionSizePct,
    ...(c.stopLossPct !== undefined ? { stopLossPct: c.stopLossPct } : {}),
    ...(c.takeProfitPct !== undefined ? { takeProfitPct: c.takeProfitPct } : {}) };
  const num = (v: unknown, d: number, lo: number, hi: number) => {
    const x = typeof v === "number" && Number.isFinite(v) ? v : d;
    return Math.min(hi, Math.max(lo, x));
  };
  if (template === "ma_cross") {
    const d = DEFAULT_PARAMS.ma_cross;
    let fast = Math.round(num(params?.fast, d.fast, 2, 200));
    let slow = Math.round(num(params?.slow, d.slow, 3, 400));
    if (fast >= slow) [fast, slow] = [Math.min(fast, slow - 1), Math.max(slow, fast + 1)];
    const kind = params?.kind === "ema" ? "ema" : "sma";
    const K = kind.toUpperCase();
    return {
      name: `${K} ${fast}/${slow} crossover`, template, summary: `Buy when the ${fast}-bar ${K} crosses above the ${slow}-bar ${K}; sell when it crosses back below.`,
      entry: [{ left: { kind: "indicator", name: kind, period: fast }, op: "crosses_above", right: { kind: "indicator", name: kind, period: slow } }],
      exit: [{ left: { kind: "indicator", name: kind, period: fast }, op: "crosses_below", right: { kind: "indicator", name: kind, period: slow } }],
      ...base,
    };
  }
  if (template === "rsi_reversion") {
    const d = DEFAULT_PARAMS.rsi_reversion;
    const period = Math.round(num(params?.period, d.period, 2, 100));
    const oversold = num(params?.oversold, d.oversold, 5, 50);
    const overbought = num(params?.overbought, d.overbought, 40, 95);
    return {
      name: `RSI(${period}) dip buyer`, template, summary: `Buy when RSI(${period}) drops below ${oversold}; sell when it rises above ${overbought}.`,
      entry: [{ left: { kind: "indicator", name: "rsi", period }, op: "below", right: { kind: "value", value: oversold } }],
      exit: [{ left: { kind: "indicator", name: "rsi", period }, op: "above", right: { kind: "value", value: overbought } }],
      ...base,
    };
  }
  const d = DEFAULT_PARAMS.breakout;
  const lookback = Math.round(num(params?.lookback, d.lookback, 2, 300));
  const exitLookback = Math.round(num(params?.exitLookback, d.exitLookback, 2, 300));
  return {
    name: `${lookback}-bar breakout`, template: "breakout",
    summary: `Buy when the close breaks above the highest high of the previous ${lookback} bars; sell when it closes below the lowest low of the previous ${exitLookback}.`,
    entry: [{ left: { kind: "indicator", name: "close" }, op: "above", right: { kind: "indicator", name: "highest", period: lookback } }],
    exit: [{ left: { kind: "indicator", name: "close" }, op: "below", right: { kind: "indicator", name: "lowest", period: exitLookback } }],
    ...base,
  };
}

const opText: Record<string, string> = { crosses_above: "crosses above", crosses_below: "crosses below", above: "is above", below: "is below" };
function operandText(o: StrategySpec["entry"][number]["left"]): string {
  if (o.kind === "value") return String(o.value);
  if (o.name === "close") return "close";
  if (o.name === "highest") return `highest high of previous ${o.period} bars`;
  if (o.name === "lowest") return `lowest low of previous ${o.period} bars`;
  return `${o.name.toUpperCase()}(${o.period})`;
}

/** Plain-English rules, one line per rule, for the UI "agent understood" panel. */
export function describeRules(spec: StrategySpec): { entry: string[]; exit: string[]; risk: string[]; costs: string[] } {
  const line = (c: StrategySpec["entry"][number]) => `${operandText(c.left)} ${opText[c.op]} ${operandText(c.right)}`;
  const risk: string[] = [];
  if (spec.stopLossPct !== undefined) risk.push(`Stop-loss ${spec.stopLossPct}% below entry`);
  if (spec.takeProfitPct !== undefined) risk.push(`Take-profit ${spec.takeProfitPct}% above entry`);
  risk.push(`Commit ${spec.positionSizePct}% of equity per trade, long only, no leverage`);
  return {
    entry: spec.entry.map(line),
    exit: spec.exit.map(line),
    risk,
    costs: [`Fee ${spec.feePct}% per side`, `Slippage ${spec.slippagePct}% per side`, `Start capital ${spec.initialCapital.toLocaleString("en-US")}`],
  };
}
