import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { extractJson, llmParse, type LlmConfig } from "../src/llm/client.js";
import { buildFromTemplate } from "../src/engine/templates.js";

describe("http api", () => {
  it("lists datasets and runs a backtest end to end", async () => {
    const app = await buildApp();
    const ds = (await app.inject("/api/datasets")).json().datasets;
    expect(ds.length).toBeGreaterThanOrEqual(4);
    const parsed = (await app.inject({ method: "POST", url: "/api/parse", payload: { prompt: "RSI below 30 buy, above 55 sell" } })).json();
    expect(parsed.source).toBe("rules");
    const res = await app.inject({ method: "POST", url: "/api/backtest", payload: { spec: parsed.spec, datasetId: "synth-chop-1d" } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.report.metrics.trades).toBeGreaterThan(0);
    expect(body.report.analysis.checks.find((c: any) => c.id === "data").status).toBe("warn");
    expect(body.sandbox.isolation.processSpawn).toBe("denied");
    await app.close();
  });
  it("rejects invalid specs and unknown datasets before any sandbox spins up", async () => {
    const app = await buildApp();
    expect((await app.inject({ method: "POST", url: "/api/backtest", payload: { spec: { x: 1 }, datasetId: "btc-usd-1d" } })).statusCode).toBe(400);
    expect((await app.inject({ method: "POST", url: "/api/backtest", payload: { spec: buildFromTemplate("breakout", {}), datasetId: "nope" } })).statusCode).toBe(400);
    await app.close();
  });
  it("accepts uploaded CSV and labels it custom", async () => {
    const app = await buildApp();
    const rows = ["time,open,high,low,close,volume"];
    let p = 100;
    for (let i = 0; i < 200; i++) { const o = p; p = p * (1 + Math.sin(i / 7) * 0.02); rows.push(`2023-${String(1 + Math.floor(i / 28)).padStart(2, "0")}-${String(1 + (i % 28)).padStart(2, "0")},${o},${Math.max(o, p) * 1.01},${Math.min(o, p) * 0.99},${p},10`); }
    const res = await app.inject({ method: "POST", url: "/api/backtest", payload: { spec: buildFromTemplate("ma_cross", { fast: 5, slow: 15 }), csv: { name: "mine", text: rows.join("\n") } } });
    expect(res.statusCode).toBe(200);
    expect(res.json().report.dataset.kind).toBe("custom");
    await app.close();
  });
});

describe("llm hook", () => {
  const cfg: LlmConfig = { enabled: true, baseUrl: "http://mock/v1", apiKey: "k", model: "m", timeoutMs: 1000 };
  const reply = (content: string) => (async () => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 })) as unknown as typeof fetch;
  const good = buildFromTemplate("breakout", { lookback: 30 });
  afterEach(() => undefined);

  it("is disabled without a key", async () => {
    await expect(llmParse("x", {}, { ...cfg, enabled: false })).rejects.toThrow(/not enabled/);
  });
  it("accepts a valid spec, including inside a markdown fence", async () => {
    const spec = await llmParse("30 day breakout", {}, cfg, reply("```json\n" + JSON.stringify(good) + "\n```"));
    expect(spec.entry[0]!.right).toMatchObject({ name: "highest", period: 30 });
  });
  it("sends the key only as a bearer header and the prompt as data", async () => {
    let seen: any;
    const f = (async (url: string, init: any) => { seen = { url, init }; return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(good) } }] })); }) as unknown as typeof fetch;
    await llmParse("hello", {}, cfg, f);
    expect(seen.url).toBe("http://mock/v1/chat/completions");
    expect(seen.init.headers.authorization).toBe("Bearer k");
    expect(seen.init.body).not.toContain("\"k\"");
  });
  it("rejects anything that isn't a valid declarative spec (e.g. code, unknown indicators)", async () => {
    const bad = { ...good, entry: [{ left: { kind: "indicator", name: "require('child_process')", period: 3 }, op: "above", right: { kind: "value", value: 1 } }] };
    await expect(llmParse("x", {}, cfg, reply(JSON.stringify(bad)))).rejects.toThrow(/invalid spec/);
    await expect(llmParse("x", {}, cfg, reply("import os; os.system('rm -rf /')"))).rejects.toThrow();
  });
  it("extractJson tolerates chatter around the object", () => {
    expect(extractJson("Sure! {\"a\":1} hope that helps")).toEqual({ a: 1 });
  });
  it("API falls back to the rule parser when the LLM is down", async () => {
    process.env.LLM_ENABLED = "true"; process.env.LLM_API_KEY = "k"; process.env.LLM_MODEL = "m"; process.env.LLM_BASE_URL = "http://127.0.0.1:9/v1"; process.env.LLM_TIMEOUT_MS = "800";
    const app = await buildApp();
    const body = (await app.inject({ method: "POST", url: "/api/parse", payload: { prompt: "sma 10 20 crossover" } })).json();
    expect(body.source).toBe("rules");
    expect(body.notes.join(" ")).toMatch(/LLM unavailable/);
    for (const k of ["LLM_ENABLED", "LLM_API_KEY", "LLM_MODEL", "LLM_BASE_URL", "LLM_TIMEOUT_MS"]) delete process.env[k];
    await app.close();
  });
});
