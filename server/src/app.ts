import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import { existsSync } from "node:fs";
import { z } from "zod";
import { getCandles, getDatasetMeta, inferBarsPerYear, listDatasets, parseCsv } from "./data.js";
import { parseStrategyText } from "./engine/parser.js";
import { safeValidateSpec } from "./engine/spec.js";
import { buildFromTemplate, DEFAULT_COMMON, DEFAULT_PARAMS, describeRules, TEMPLATE_INFO } from "./engine/templates.js";
import type { Candle, Report } from "./engine/types.js";
import { llmConfig, llmParse } from "./llm/client.js";
import { runInSandbox, sandboxStatus } from "./sandbox/host.js";

const commonSchema = z.object({
  feePct: z.number().min(0).max(5), slippagePct: z.number().min(0).max(5),
  initialCapital: z.number().min(100).max(1e9), positionSizePct: z.number().min(1).max(100),
  stopLossPct: z.number().min(0.1).max(90).optional(), takeProfitPct: z.number().min(0.1).max(1000).optional(),
}).partial();

// tiny in-memory limiter + concurrency cap so a public demo can't be hammered
const hits = new Map<string, number[]>();
function limited(ip: string, perMin: number) {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < 60000);
  arr.push(now); hits.set(ip, arr);
  return arr.length > perMin;
}
let running = 0;
const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT_SANDBOXES ?? 4);

export async function buildApp(opts: { staticDir?: string; logger?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? false, bodyLimit: 3 * 1024 * 1024 });
  await app.register(cors, { origin: true });

  app.get("/api/health", async () => ({ ok: true, name: "prove-it-backtester", time: new Date().toISOString() }));

  app.get("/api/config", async () => {
    const llm = llmConfig();
    return {
      llm: { enabled: llm.enabled, model: llm.enabled ? llm.model : null },
      sandbox: sandboxStatus(),
      templates: Object.entries(TEMPLATE_INFO).map(([id, v]) => ({ id, ...v, defaults: DEFAULT_PARAMS[id as keyof typeof DEFAULT_PARAMS] })),
      defaults: DEFAULT_COMMON,
    };
  });

  app.get("/api/datasets", async () => ({ datasets: listDatasets() }));

  app.post("/api/spec/build", async (req, reply) => {
    const body = z.object({ template: z.enum(["ma_cross", "rsi_reversion", "breakout"]), params: z.record(z.unknown()).optional(), common: commonSchema.optional() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "Invalid request." });
    const spec = buildFromTemplate(body.data.template, body.data.params, body.data.common);
    return { spec, rules: describeRules(spec) };
  });

  app.post("/api/parse", async (req, reply) => {
    const body = z.object({ prompt: z.string().min(3).max(2000), common: commonSchema.optional() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "Describe your strategy in a sentence or two." });
    const cfg = llmConfig();
    const notes: string[] = [];
    if (cfg.enabled) {
      try {
        const spec = await llmParse(body.data.prompt, body.data.common ?? {}, cfg);
        return { source: "llm", model: cfg.model, spec, rules: describeRules(spec), notes: ["Rules written by the language model, then validated against the strict spec schema."] };
      } catch (e) {
        notes.push(`LLM unavailable (${(e as Error).message}); used the built-in rule parser instead.`);
      }
    }
    const r = parseStrategyText(body.data.prompt, body.data.common ?? {});
    return { source: "rules", spec: r.spec, rules: describeRules(r.spec), recognised: r.recognised, datasetHint: r.datasetHint, notes: [...notes, ...r.notes] };
  });

  app.post("/api/backtest", async (req, reply) => {
    if (limited(req.ip, Number(process.env.RATE_LIMIT_PER_MIN ?? 40))) return reply.code(429).send({ error: "Too many runs. Wait a minute." });
    const body = z.object({
      spec: z.unknown(), datasetId: z.string().optional(),
      csv: z.object({ name: z.string().max(60).default("Uploaded data"), text: z.string().max(2_500_000) }).optional(),
    }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "Invalid request." });
    const v = safeValidateSpec(body.data.spec);
    if (!v.ok) return reply.code(400).send({ error: `Invalid strategy: ${v.error}` });

    let candles: Candle[]; let dataset: Report["dataset"]; let barsPerYear: number;
    if (body.data.csv) {
      try { candles = parseCsv(body.data.csv.text); } catch (e) { return reply.code(400).send({ error: (e as Error).message }); }
      barsPerYear = inferBarsPerYear(candles);
      dataset = { id: "custom", name: body.data.csv.name, kind: "custom", source: "Uploaded by you", bars: 0, from: "", to: "" };
    } else {
      const meta = getDatasetMeta(body.data.datasetId ?? "");
      if (!meta) return reply.code(400).send({ error: "Unknown dataset." });
      candles = getCandles(meta.id)!; barsPerYear = meta.barsPerYear;
      dataset = { id: meta.id, name: meta.name, kind: meta.kind, source: meta.source, bars: 0, from: "", to: "" };
    }
    if (running >= MAX_CONCURRENT) return reply.code(503).send({ error: "Sandbox pool is busy. Try again in a moment." });
    running++;
    try {
      const r = await runInSandbox({ mode: "backtest", spec: v.spec, candles, dataset, barsPerYear });
      if (r.error || !r.output) return reply.code(422).send({ error: r.error ?? "Backtest failed.", sandbox: r.meta });
      return { report: r.output.report as Report, rules: describeRules(v.spec), sandbox: r.meta };
    } finally { running--; }
  });

  // Containment lab: each probe really executes hostile-looking code paths inside a real sandbox.
  const PROBES = {
    env: { title: "Read host secrets from the environment", wallMs: 5000 },
    fs: { title: "Read /etc/passwd from disk", wallMs: 5000 },
    spawn: { title: "Spawn a shell", wallMs: 5000 },
    net: { title: "Call out to the internet", wallMs: 8000 },
    loop: { title: "Spin the CPU forever", wallMs: 1500 },
    memory: { title: "Allocate memory until it breaks", wallMs: 8000 },
  } as const;
  app.get("/api/sandbox/probes", async () => ({ probes: Object.entries(PROBES).map(([id, p]) => ({ id, title: p.title })) }));
  app.post("/api/sandbox/probe", async (req, reply) => {
    if (limited(req.ip, 60)) return reply.code(429).send({ error: "Too many runs. Wait a minute." });
    const body = z.object({ probe: z.enum(["env", "fs", "spawn", "net", "loop", "memory"]) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "Unknown probe." });
    if (running >= MAX_CONCURRENT) return reply.code(503).send({ error: "Sandbox pool is busy." });
    running++;
    try {
      const p = PROBES[body.data.probe];
      process.env.PROVEIT_CANARY_SECRET = "canary-not-a-real-secret"; // exists in the HOST so we can prove the sandbox can't see it
      const r = await runInSandbox({ mode: "probe", probe: body.data.probe }, { heapMb: 96 }, { wallMs: p.wallMs });
      let outcome: "blocked" | "allowed" | "killed" = "blocked"; let detail: string;
      if (r.meta.killedBy === "timeout") { outcome = "killed"; detail = `Runaway process killed by the host after ${r.meta.limits.wallMs} ms (SIGKILL).`; }
      else if (body.data.probe === "memory" && !r.output) { outcome = "killed"; detail = r.error ?? `Process crashed at the ${r.meta.limits.heapMb} MB memory cap.`; }
      else if (r.output?.probe) { outcome = r.output.probe.outcome; detail = r.output.probe.detail; }
      else { detail = r.error ?? "No result."; }
      return { id: body.data.probe, title: p.title, outcome, detail, sandbox: r.meta };
    } finally { running--; }
  });

  if (opts.staticDir && existsSync(opts.staticDir)) {
    await app.register(fastifyStatic, { root: opts.staticDir, wildcard: false });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api/")) return reply.code(404).send({ error: "Not found" });
      return reply.sendFile("index.html");
    });
  }
  return app;
}
