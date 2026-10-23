import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const RUNNER_PATH = process.env.SANDBOX_RUNNER ? resolve(process.env.SANDBOX_RUNNER) : resolve(here, "../../dist/runner.cjs");

const nodeMajor = Number(process.versions.node.split(".")[0]);
const PERMISSION_FLAG = nodeMajor >= 22 ? "--permission" : "--experimental-permission";

let unshareBin: string | null | undefined;
function netIsolation(): string | null {
  if (unshareBin !== undefined) return unshareBin;
  unshareBin = null;
  if (process.platform === "linux" && process.env.SANDBOX_NET_ISOLATION !== "off") {
    const which = spawnSync("sh", ["-c", "command -v unshare"], { encoding: "utf8" });
    const p = which.stdout.trim();
    if (p && spawnSync(p, ["-rn", "true"], { stdio: "ignore" }).status === 0) unshareBin = p;
  }
  return unshareBin;
}

export interface SandboxEvent { atMs: number; stage: "create" | "spawn" | "feed" | "run" | "result" | "kill" | "destroy"; message: string }
export interface SandboxMeta {
  id: string; mode: "process"; node: string; flags: string[];
  limits: { wallMs: number; heapMb: number; maxOutputMb: number };
  isolation: { filesystem: string; processSpawn: string; env: string; network: string };
  pid?: number; wallMs: number; exitCode: number | null; signal: string | null; killedBy: "timeout" | "output_cap" | null;
  events: SandboxEvent[];
}
export interface SandboxResult { output: any | null; error?: string; meta: SandboxMeta }

export interface SandboxLimits { wallMs: number; heapMb: number; maxOutputMb: number }
export const DEFAULT_LIMITS: SandboxLimits = {
  wallMs: Number(process.env.SANDBOX_TIMEOUT_MS ?? 20000),
  heapMb: Number(process.env.SANDBOX_HEAP_MB ?? 256),
  maxOutputMb: 24,
};

export function sandboxStatus() {
  const ok = existsSync(RUNNER_PATH);
  const net = netIsolation();
  return {
    runnerReady: ok, node: process.versions.node, permissionFlag: PERMISSION_FLAG,
    limits: DEFAULT_LIMITS,
    layers: [
      { id: "fs", label: "Filesystem", state: "enforced", detail: "Node permission model: no filesystem read except the runner file; no writes." },
      { id: "spawn", label: "Process spawn", state: "enforced", detail: "Child processes and workers are denied by the permission model." },
      { id: "env", label: "Environment", state: "enforced", detail: "The sandbox starts with an empty environment: no API keys or tokens exist inside it." },
      { id: "limits", label: "CPU / memory / time", state: "enforced", detail: `Wall-clock cap ${DEFAULT_LIMITS.wallMs / 1000}s, V8 heap cap ${DEFAULT_LIMITS.heapMb} MB, output cap ${DEFAULT_LIMITS.maxOutputMb} MB, SIGKILL on breach.` },
      { id: "net", label: "Network egress", state: net ? "enforced" : "not_available", detail: net ? "Runs in an empty network namespace (unshare -rn): no interfaces, no egress." : "Not available on this host (no unprivileged user namespaces, e.g. default Docker seccomp). Rely on the VM firewall or run on a bare VM. The sandbox still holds no secrets." },
      { id: "life", label: "Lifecycle", state: "enforced", detail: "One throw-away process and scratch dir per run, destroyed when the run ends." },
    ],
  };
}

export async function runInSandbox(input: unknown, limits: Partial<SandboxLimits> = {}, opts: { wallMs?: number } = {}): Promise<SandboxResult> {
  const lim = { ...DEFAULT_LIMITS, ...limits, ...(opts.wallMs ? { wallMs: opts.wallMs } : {}) };
  const id = randomUUID().slice(0, 8);
  const t0 = performance.now();
  const events: SandboxEvent[] = [];
  const ev = (stage: SandboxEvent["stage"], message: string) => events.push({ atMs: Math.round(performance.now() - t0), stage, message });
  const net = netIsolation();
  const flags = [PERMISSION_FLAG, `--allow-fs-read=${RUNNER_PATH}`, `--max-old-space-size=${lim.heapMb}`];

  const meta: SandboxMeta = {
    id, mode: "process", node: process.versions.node, flags, limits: { wallMs: lim.wallMs, heapMb: lim.heapMb, maxOutputMb: lim.maxOutputMb },
    isolation: {
      filesystem: "read-only runner file, nothing else", processSpawn: "denied", env: "empty",
      network: net ? "empty network namespace" : "not isolated at process level",
    },
    wallMs: 0, exitCode: null, signal: null, killedBy: null, events,
  };
  if (!existsSync(RUNNER_PATH)) return { output: null, error: "Sandbox runner is not built. Run `npm run build -w server`.", meta };

  ev("create", `Sandbox ${id} created`);
  const scratch = await mkdtemp(join(tmpdir(), `proveit-${id}-`));
  ev("create", "Scratch directory allocated (empty, no secrets)");
  try {
    const cmd = net ? net : process.execPath;
    const args = net ? ["-rn", process.execPath, ...flags, RUNNER_PATH] : [...flags, RUNNER_PATH];
    const child = spawn(cmd, args, { cwd: scratch, env: {}, stdio: ["pipe", "pipe", "pipe"] });
    meta.pid = child.pid;
    ev("spawn", `Spawned pid ${child.pid} with ${PERMISSION_FLAG}, heap ${lim.heapMb} MB${net ? ", no network" : ""}`);

    let stdout = "", stderr = "", bytes = 0;
    const cap = lim.maxOutputMb * 1024 * 1024;
    const done = new Promise<void>((res) => child.on("close", (code, signal) => { meta.exitCode = code; meta.signal = signal; res(); }));
    child.stdout.on("data", (d: Buffer) => {
      bytes += d.length;
      if (bytes > cap) { meta.killedBy = "output_cap"; ev("kill", "Output cap exceeded, killing"); child.kill("SIGKILL"); return; }
      stdout += d.toString("utf8");
    });
    child.stderr.on("data", (d: Buffer) => { if (stderr.length < 4000) stderr += d.toString("utf8"); });
    child.stdin.on("error", () => { /* child may die before reading */ });
    const timer = setTimeout(() => { meta.killedBy = "timeout"; ev("kill", `Wall-clock limit ${lim.wallMs} ms reached, sending SIGKILL`); child.kill("SIGKILL"); }, lim.wallMs);

    const payload = JSON.stringify(input);
    child.stdin.end(payload);
    ev("feed", `Sent job to sandbox (${(payload.length / 1024).toFixed(0)} KB, data only, no code)`);
    ev("run", "Backtest running inside the sandbox");
    await done;
    clearTimeout(timer);

    let output: any = null, error: string | undefined;
    try { output = stdout ? JSON.parse(stdout) : null; } catch { error = "Sandbox returned malformed output."; }
    if (meta.killedBy === "timeout") error = `Killed: exceeded ${lim.wallMs} ms wall-clock limit.`;
    else if (meta.killedBy === "output_cap") error = "Killed: output exceeded the cap.";
    else if (!output) {
      const oom = /heap out of memory|allocation failed/i.test(stderr) || meta.signal === "SIGABRT";
      error = oom ? `Killed: exceeded ${lim.heapMb} MB memory cap.` : `Sandbox exited with code ${meta.exitCode}${stderr ? `: ${stderr.split("\n")[0]}` : ""}`;
    } else if (output.ok === false) error = output.error;
    ev("result", error ? `Run ended: ${error}` : "Result received, output parsed");
    await rm(scratch, { recursive: true, force: true });
    ev("destroy", `Process exited (code ${meta.exitCode ?? "none"}${meta.signal ? `, ${meta.signal}` : ""}); scratch directory removed`);
    meta.wallMs = Math.round(performance.now() - t0);
    return { output: error ? null : output, error, meta };
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}
