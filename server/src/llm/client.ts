import { safeValidateSpec } from "../engine/spec.js";
import { DEFAULT_COMMON, type CommonParams } from "../engine/templates.js";
import type { StrategySpec } from "../engine/types.js";

export interface LlmConfig { enabled: boolean; baseUrl: string; apiKey: string; model: string; timeoutMs: number }

export function llmConfig(env: NodeJS.ProcessEnv = process.env): LlmConfig {
  const key = (env.VULTR_INFERENCE_API_KEY || env.LLM_API_KEY || "").trim();
  // On when a key is present, unless explicitly disabled with LLM_ENABLED=false.
  return {
    enabled: key.length > 0 && env.LLM_ENABLED !== "false",
    baseUrl: (env.LLM_BASE_URL ?? "https://api.vultrinference.com/v1").replace(/\/$/, ""),
    apiKey: key,
    model: env.LLM_MODEL ?? "",
    timeoutMs: Number(env.LLM_TIMEOUT_MS ?? 25000),
  };
}

const SYSTEM = `You convert a trader's plain-English idea into a JSON strategy spec for a backtesting engine.
Reply with ONE JSON object and nothing else. Never write code. Never include prose.
Schema:
{
  "name": string,
  "template": "ma_cross" | "rsi_reversion" | "breakout" | "custom",
  "summary": string,
  "entry": Condition[]   // 1-4 conditions, ALL must hold
  "exit": Condition[]    // 0-4 conditions, ANY triggers an exit
  "stopLossPct"?: number, "takeProfitPct"?: number,
  "feePct": number, "slippagePct": number, "initialCapital": number, "positionSizePct": number
}
Condition = { "left": Operand, "op": "crosses_above" | "crosses_below" | "above" | "below", "right": Operand }
Operand = { "kind": "indicator", "name": "sma"|"ema"|"rsi"|"highest"|"lowest"|"close", "period"?: integer 2-400 } | { "kind": "value", "value": number }
Notes: "close" takes no period. "highest"/"lowest" are the previous N bars' high/low. The engine is long-only, spot, no leverage.
If the user asks for shorting, leverage or anything unsupported, ignore that part and keep the closest long-only version.
Use feePct ${DEFAULT_COMMON.feePct}, slippagePct ${DEFAULT_COMMON.slippagePct}, initialCapital ${DEFAULT_COMMON.initialCapital}, positionSizePct ${DEFAULT_COMMON.positionSizePct} unless the user specifies otherwise.
Every strategy needs at least one exit condition, stopLossPct or takeProfitPct.`;

export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1]! : text).trim();
  const start = body.indexOf("{"), end = body.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("No JSON object in model reply.");
  return JSON.parse(body.slice(start, end + 1));
}

let cachedModel = "";
/** If LLM_MODEL is unset, pick the first chat model the endpoint lists at GET /models. */
async function discoverModel(cfg: LlmConfig, fetchImpl: typeof fetch): Promise<string> {
  if (cachedModel) return cachedModel;
  const res = await fetchImpl(`${cfg.baseUrl}/models`, { headers: { authorization: `Bearer ${cfg.apiKey}` }, signal: AbortSignal.timeout(cfg.timeoutMs) });
  if (!res.ok) throw new Error(`Model list returned HTTP ${res.status}.`);
  const j = (await res.json()) as { data?: { id?: string }[] };
  const ids = (j.data ?? []).map((m) => m.id ?? "").filter(Boolean);
  const pick = ids.find((id) => !/embed|whisper|tts|image|flux|stable/i.test(id));
  if (!pick) throw new Error("No chat model available.");
  return (cachedModel = pick);
}

/**
 * Natural language -> validated StrategySpec through any OpenAI-compatible chat endpoint
 * (Vultr Serverless Inference, OpenAI, a local vLLM, ...). The reply is parsed as DATA and
 * validated against a strict schema; it is never executed.
 */
export async function llmParse(prompt: string, common: Partial<CommonParams>, cfg: LlmConfig, fetchImpl: typeof fetch = fetch): Promise<StrategySpec> {
  if (!cfg.enabled) throw new Error("LLM is not enabled.");
  const model = cfg.model || (await discoverModel(cfg, fetchImpl));
  const res = await fetchImpl(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model, temperature: 0, max_tokens: 900,
      messages: [{ role: "system", content: SYSTEM }, { role: "user", content: prompt.slice(0, 2000) }],
    }),
    signal: AbortSignal.timeout(cfg.timeoutMs),
  });
  if (!res.ok) throw new Error(`LLM endpoint returned HTTP ${res.status}.`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM reply was empty.");
  const raw = extractJson(content) as Record<string, unknown>;
  const merged = { ...DEFAULT_COMMON, ...common, ...raw };
  const v = safeValidateSpec(merged);
  if (!v.ok) throw new Error(`LLM returned an invalid spec: ${v.error}`);
  return v.spec;
}
