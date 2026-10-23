export interface Candle {
  t: string; // ISO date or datetime
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export type IndicatorName = "sma" | "ema" | "rsi" | "highest" | "lowest" | "close";

export type Operand =
  | { kind: "indicator"; name: IndicatorName; period?: number }
  | { kind: "value"; value: number };

export type Comparator = "crosses_above" | "crosses_below" | "above" | "below";

export interface Condition {
  left: Operand;
  op: Comparator;
  right: Operand;
}

export type Template = "ma_cross" | "rsi_reversion" | "breakout" | "custom";

/**
 * Declarative, data-only strategy. The LLM (or the rule parser) can only ever
 * produce this shape; nothing here is executable code.
 * Entry conditions are ANDed. Exit conditions are ORed.
 */
export interface StrategySpec {
  name: string;
  template: Template;
  summary?: string;
  entry: Condition[];
  exit: Condition[];
  stopLossPct?: number;
  takeProfitPct?: number;
  feePct: number; // per side, % of notional
  slippagePct: number; // per side, % of price
  initialCapital: number;
  positionSizePct: number; // % of equity committed per trade (no leverage)
}

export interface Trade {
  entryIdx: number;
  exitIdx: number;
  entryTime: string;
  exitTime: string;
  entryPrice: number;
  exitPrice: number;
  qty: number;
  pnl: number;
  retPct: number;
  bars: number;
  reason: "signal" | "stop_loss" | "take_profit" | "end_of_data";
}

export interface Metrics {
  finalEquity: number;
  totalReturnPct: number;
  cagrPct: number;
  maxDrawdownPct: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  trades: number;
  winRatePct: number;
  profitFactor: number;
  avgTradePct: number;
  avgBarsHeld: number;
  exposurePct: number;
  feesPaid: number;
}

export interface BenchmarkMetrics {
  finalEquity: number;
  totalReturnPct: number;
  cagrPct: number;
  maxDrawdownPct: number;
  sharpe: number;
}

export type CheckStatus = "pass" | "info" | "warn" | "fail";

export interface Check {
  id: string;
  status: CheckStatus;
  title: string;
  detail: string;
}

export type VerdictLabel = "not_credible" | "inconclusive" | "holds_up";

export interface Analysis {
  checks: Check[];
  verdict: { label: VerdictLabel; headline: string; reasons: string[] };
  split: {
    splitIdx: number;
    splitTime: string;
    inSample: { returnPct: number; benchmarkPct: number };
    outSample: { returnPct: number; benchmarkPct: number };
  } | null;
  sensitivity: {
    runs: number;
    positiveShare: number;
    medianReturnPct: number;
    worstReturnPct: number;
    bestReturnPct: number;
  } | null;
  costStress: { returnPct: number; multiple: number } | null;
  bootstrap: {
    samples: number;
    maxDrawdownP50: number;
    maxDrawdownP95: number;
    returnP5: number;
    returnP50: number;
    returnP95: number;
  } | null;
}

export interface Report {
  spec: StrategySpec;
  dataset: { id: string; name: string; kind: "real" | "synthetic" | "custom"; source: string; bars: number; from: string; to: string };
  times: string[];
  equity: number[];
  benchmark: number[];
  drawdown: number[]; // percent, <= 0
  benchmarkDrawdown: number[];
  trades: Trade[];
  metrics: Metrics;
  benchmarkMetrics: BenchmarkMetrics;
  analysis: Analysis;
  engineMs: number;
}
