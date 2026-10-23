import { z } from "zod";
import type { StrategySpec } from "./types.js";

const period = z.number().int().min(2).max(400);

const operand = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("indicator"),
    name: z.enum(["sma", "ema", "rsi", "highest", "lowest", "close"]),
    period: period.optional(),
  }),
  z.object({ kind: z.literal("value"), value: z.number().finite().min(-1e9).max(1e9) }),
]);

const condition = z.object({
  left: operand,
  op: z.enum(["crosses_above", "crosses_below", "above", "below"]),
  right: operand,
});

export const specSchema = z
  .object({
    name: z.string().min(1).max(80),
    template: z.enum(["ma_cross", "rsi_reversion", "breakout", "custom"]),
    summary: z.string().max(400).optional(),
    entry: z.array(condition).min(1).max(4),
    exit: z.array(condition).max(4),
    stopLossPct: z.number().min(0.1).max(90).optional(),
    takeProfitPct: z.number().min(0.1).max(1000).optional(),
    feePct: z.number().min(0).max(5),
    slippagePct: z.number().min(0).max(5),
    initialCapital: z.number().min(100).max(1e9),
    positionSizePct: z.number().min(1).max(100),
  })
  .superRefine((s, ctx) => {
    if (s.exit.length === 0 && s.stopLossPct === undefined && s.takeProfitPct === undefined) {
      ctx.addIssue({ code: "custom", message: "Strategy needs at least one exit rule, stop-loss or take-profit." });
    }
    const all = [...s.entry, ...s.exit];
    for (const c of all) {
      for (const o of [c.left, c.right]) {
        if (o.kind === "indicator" && o.name !== "close" && o.period === undefined) {
          ctx.addIssue({ code: "custom", message: `Indicator ${o.name} needs a period.` });
        }
      }
    }
  });

export function validateSpec(input: unknown): StrategySpec {
  return specSchema.parse(input) as StrategySpec;
}

export function safeValidateSpec(input: unknown) {
  const r = specSchema.safeParse(input);
  return r.success
    ? { ok: true as const, spec: r.data as StrategySpec }
    : { ok: false as const, error: r.error.issues.map((i) => `${i.path.join(".") || "spec"}: ${i.message}`).join("; ") };
}
