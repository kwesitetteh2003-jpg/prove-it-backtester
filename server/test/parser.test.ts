import { describe, expect, it } from "vitest";
import { parseStrategyText } from "../src/engine/parser.js";
import { parseCsv, inferBarsPerYear } from "../src/data.js";
import { safeValidateSpec } from "../src/engine/spec.js";

describe("rule-based parser", () => {
  it("reads a moving-average crossover with lengths", () => {
    const r = parseStrategyText("Buy BTC when the 50 day moving average crosses above the 200 day, sell when it crosses back");
    expect(r.spec.template).toBe("ma_cross");
    expect(r.spec.entry[0]!.left).toMatchObject({ name: "sma", period: 50 });
    expect(r.spec.entry[0]!.right).toMatchObject({ name: "sma", period: 200 });
    expect(r.datasetHint).toBe("btc-usd-1d");
  });
  it("reads EMA and orders the lengths fast/slow", () => {
    const r = parseStrategyText("ema 30 / 10 crossover");
    expect(r.spec.entry[0]!.left).toMatchObject({ name: "ema", period: 10 });
  });
  it("reads RSI thresholds and a stop-loss", () => {
    const r = parseStrategyText("buy when RSI(10) drops below 25, sell above 60, with a 5% stop loss");
    expect(r.spec.template).toBe("rsi_reversion");
    expect(r.spec.entry[0]!.right).toMatchObject({ value: 25 });
    expect(r.spec.exit[0]!.right).toMatchObject({ value: 60 });
    expect(r.spec.stopLossPct).toBe(5);
  });
  it("reads a breakout lookback", () => {
    const r = parseStrategyText("buy ETH on a 55-day high breakout");
    expect(r.spec.template).toBe("breakout");
    expect(r.spec.entry[0]!.right).toMatchObject({ name: "highest", period: 55 });
    expect(r.datasetHint).toBe("eth-usd-1d");
  });
  it("falls back honestly when it can't tell", () => {
    const r = parseStrategyText("make me rich");
    expect(r.recognised).toBe(false);
    expect(r.notes[0]).toMatch(/default/i);
  });
  it("always produces a valid spec and drops unsupported ideas with a note", () => {
    for (const t of ["short the market with 10x leverage when RSI is above 80", "sma 3 and 9", "breakout 20 with take profit 15% and fee 0.2%"]) {
      const r = parseStrategyText(t);
      expect(safeValidateSpec(r.spec).ok).toBe(true);
    }
    expect(parseStrategyText("short with leverage on RSI").notes.join(" ")).toMatch(/long-only/);
  });
});

describe("csv loader", () => {
  const good = "time,open,high,low,close,volume\n2024-01-01,10,11,9,10.5,100\n2024-01-02,10.5,12,10,11,120\n2024-01-03,11,11.5,10.5,11.2,90\n";
  it("parses valid candles", () => {
    expect(parseCsv(good)).toHaveLength(3);
    expect(inferBarsPerYear(parseCsv(good))).toBe(365);
  });
  it("rejects bad headers, inconsistent high/low and unsorted time", () => {
    expect(() => parseCsv("a,b\n1,2")).toThrow();
    expect(() => parseCsv("time,open,high,low,close\n2024-01-01,10,9,8,10")).toThrow(/inconsistent/);
    expect(() => parseCsv("time,open,high,low,close\n2024-01-02,10,11,9,10\n2024-01-01,10,11,9,10")).toThrow(/increasing/);
  });
});
