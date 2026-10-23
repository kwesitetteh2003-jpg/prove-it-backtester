import type { Report, StrategySpec } from "../../../server/src/engine/types";
export type { Report, StrategySpec, Check, Trade, Analysis } from "../../../server/src/engine/types";

export interface Rules { entry: string[]; exit: string[]; risk: string[]; costs: string[] }
export interface DatasetInfo {
  id: string; name: string; blurb: string; kind: "real" | "synthetic"; source: string; barsPerYear: number;
  bars: number; from: string; to: string; spark: number[]; firstClose: number; lastClose: number;
}
export interface SandboxEvent { atMs: number; stage: string; message: string }
export interface SandboxMeta {
  id: string; node: string; flags: string[]; pid?: number; wallMs: number; exitCode: number | null; signal: string | null; killedBy: string | null;
  limits: { wallMs: number; heapMb: number; maxOutputMb: number };
  isolation: { filesystem: string; processSpawn: string; env: string; network: string };
  events: SandboxEvent[];
}
export interface Layer { id: string; label: string; state: "enforced" | "not_available"; detail: string }
export interface Config {
  llm: { enabled: boolean; model: string | null };
  sandbox: { runnerReady: boolean; node: string; layers: Layer[]; limits: { wallMs: number; heapMb: number } };
  templates: { id: "ma_cross" | "rsi_reversion" | "breakout"; label: string; tagline: string; defaults: Record<string, number | string> }[];
  defaults: { feePct: number; slippagePct: number; initialCapital: number; positionSizePct: number };
}
export interface ParseOut { source: "rules" | "llm"; model?: string; spec: StrategySpec; rules: Rules; notes: string[]; recognised?: boolean; datasetHint?: string }
export interface RunOut { report: Report; rules: Rules; sandbox: SandboxMeta }
export interface ProbeOut { id: string; title: string; outcome: "blocked" | "allowed" | "killed"; detail: string; sandbox: SandboxMeta }

async function req<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, body === undefined ? undefined : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error((json as { error?: string }).error ?? `Request failed (${res.status})`), { payload: json });
  return json as T;
}

export const api = {
  config: () => req<Config>("/api/config"),
  datasets: () => req<{ datasets: DatasetInfo[] }>("/api/datasets").then((r) => r.datasets),
  parse: (prompt: string, common?: object) => req<ParseOut>("/api/parse", { prompt, common }),
  build: (template: string, params: object, common: object) => req<{ spec: StrategySpec; rules: Rules }>("/api/spec/build", { template, params, common }),
  run: (spec: StrategySpec, dataset: { datasetId?: string; csv?: { name: string; text: string } }) => req<RunOut>("/api/backtest", { spec, ...dataset }),
  probe: (probe: string) => req<ProbeOut>("/api/sandbox/probe", { probe }),
  probes: () => req<{ probes: { id: string; title: string }[] }>("/api/sandbox/probes").then((r) => r.probes),
};
