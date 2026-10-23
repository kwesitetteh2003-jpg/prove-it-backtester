import { buildFromTemplate, DEFAULT_PARAMS, type CommonParams } from "./templates.js";
import type { StrategySpec } from "./types.js";

export interface ParseResult {
  spec: StrategySpec;
  recognised: boolean;
  notes: string[];
  datasetHint?: string;
}

const n = (s: string | undefined) => (s === undefined ? undefined : Number(s.replace(/,/g, "")));

/**
 * Deterministic natural-language -> StrategySpec for three template families.
 * This is the no-API-key path. An LLM can replace it (see llm/), but the LLM
 * only ever returns the same declarative spec, which is validated before use.
 */
export function parseStrategyText(text: string, defaults: Partial<CommonParams> = {}): ParseResult {
  const t = text.toLowerCase().replace(/\s+/g, " ");
  const notes: string[] = [];
  const common: Partial<CommonParams> = { ...defaults };

  const stop = t.match(/stop[- ]?loss(?: of| at)?\s*(\d+(?:\.\d+)?)\s*%/) ?? t.match(/(\d+(?:\.\d+)?)\s*%\s*stop/);
  if (stop) { common.stopLossPct = n(stop[1]); notes.push(`Stop-loss ${common.stopLossPct}% picked up from your text.`); }
  const tp = t.match(/(?:take[- ]?profit|profit target|target)(?: of| at)?\s*(\d+(?:\.\d+)?)\s*%/) ?? t.match(/(\d+(?:\.\d+)?)\s*%\s*(?:take[- ]?profit|target)/);
  if (tp) { common.takeProfitPct = n(tp[1]); notes.push(`Take-profit ${common.takeProfitPct}% picked up from your text.`); }
  const fee = t.match(/fees?(?: of| at)?\s*(\d+(?:\.\d+)?)\s*%/);
  if (fee) { common.feePct = n(fee[1]); notes.push(`Fee ${common.feePct}% per side.`); }
  const size = t.match(/(\d+(?:\.\d+)?)\s*%\s*of (?:my |the )?(?:capital|equity|portfolio|account|balance)/);
  if (size) { common.positionSizePct = n(size[1]); notes.push(`Position size ${common.positionSizePct}% of equity.`); }
  const cap = t.match(/\$\s?(\d[\d,]*)(?:\s*(k))?/);
  if (cap) { common.initialCapital = (n(cap[1]) ?? 10000) * (cap[2] ? 1000 : 1); notes.push(`Starting capital ${common.initialCapital}.`); }

  let datasetHint: string | undefined;
  if (/\b(btc|bitcoin)\b/.test(t)) datasetHint = "btc-usd-1d";
  else if (/\b(eth|ethereum|ether)\b/.test(t)) datasetHint = "eth-usd-1d";
  else if (/\b(sol|solana)\b/.test(t)) datasetHint = "sol-usd-1d";

  const isRsi = /\brsi\b|oversold|overbought|mean[- ]?revers|buy the dip|\bdips?\b/.test(t);
  const isBreakout = /break ?out|breaks? (?:above|out)|new \d*[- ]?(?:day|bar|week)?[- ]?highs?|donchian|channel|\d+[- ](?:day|bar|week)s? high/.test(t);
  const isMa = /moving average|\bsma\b|\bema\b|crosses|crossover|golden cross|death cross|\bma\b/.test(t);

  let spec: StrategySpec;
  let recognised = true;
  if (isRsi) {
    const d = DEFAULT_PARAMS.rsi_reversion;
    const period = n(t.match(/rsi\s*\(?\s*(\d+)\s*\)?/)?.[1]) ?? n(t.match(/(\d+)[- ](?:day|period|bar) rsi/)?.[1]) ?? d.period;
    const below = n(t.match(/(?:below|under|<|oversold(?: at| below)?)\s*(\d+)/)?.[1]) ?? d.oversold;
    const above = n(t.match(/(?:above|over|>|overbought(?: at| above)?|sell (?:at|when it reaches|at rsi))\s*(\d+)/)?.[1]) ?? d.overbought;
    spec = buildFromTemplate("rsi_reversion", { period, oversold: below, overbought: above }, common);
    notes.unshift("Read as an RSI mean-reversion strategy.");
  } else if (isBreakout) {
    const d = DEFAULT_PARAMS.breakout;
    const lb = n(t.match(/(\d+)[- ]?(?:day|bar|period|week)s?[- ]?(?:high|breakout|channel)/)?.[1]) ?? n(t.match(/(?:high|highest)[^0-9]{0,20}(\d+)/)?.[1]) ?? n(t.match(/(\d+)/)?.[1]) ?? d.lookback;
    const ex = n(t.match(/(?:exit|sell|below)[^0-9]{0,30}(\d+)[- ]?(?:day|bar|period)?s?[- ]?(?:low|lowest)/)?.[1]) ?? Math.max(2, Math.round(lb / 2));
    spec = buildFromTemplate("breakout", { lookback: lb, exitLookback: ex }, common);
    notes.unshift("Read as a channel-breakout strategy.");
  } else if (isMa) {
    const d = DEFAULT_PARAMS.ma_cross;
    const nums = [...t.matchAll(/\b(\d{1,3})\b/g)].map((m) => Number(m[1])).filter((x) => x >= 2 && x <= 400);
    let fast = d.fast, slow = d.slow;
    if (/golden cross|death cross/.test(t) && nums.length < 2) { fast = 50; slow = 200; }
    else if (nums.length >= 2) { fast = Math.min(nums[0]!, nums[1]!); slow = Math.max(nums[0]!, nums[1]!); }
    else if (nums.length === 1) { fast = d.fast; slow = nums[0]!; if (fast >= slow) fast = Math.max(2, Math.floor(slow / 3)); notes.push("Only one length given, so a fast average was chosen for you."); }
    const kind = /\bema\b|exponential/.test(t) ? "ema" : "sma";
    spec = buildFromTemplate("ma_cross", { fast, slow, kind }, common);
    notes.unshift("Read as a moving-average crossover.");
  } else {
    recognised = false;
    spec = buildFromTemplate("ma_cross", undefined, common);
    notes.unshift("Could not recognise a strategy family, so a default 20/50 moving-average crossover was used. Try mentioning RSI, a moving-average crossover, or a breakout.");
  }
  if (/short|leverage|futures|margin/.test(t)) notes.push("Prove-It is long-only and unleveraged, so any shorting or leverage in your text was ignored.");
  return { spec, recognised, notes, datasetHint };
}
