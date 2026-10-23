// Runs INSIDE the sandboxed child process. Bundled to dist/runner.cjs (one file, no deps to resolve).
import fs from "node:fs";
import { runBacktest } from "../engine/index.js";

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (c) => chunks.push(c as Buffer));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    process.stdin.on("error", reject);
  });
}

type ProbeOut = { outcome: "blocked" | "allowed"; detail: string };

async function probe(name: string): Promise<ProbeOut> {
  switch (name) {
    case "env": {
      const keys = Object.keys(process.env);
      const canary = process.env.PROVEIT_CANARY_SECRET;
      return canary
        ? { outcome: "allowed", detail: "Canary secret was visible inside the sandbox." }
        : { outcome: "blocked", detail: `Looked for PROVEIT_CANARY_SECRET: not found. Environment inside the sandbox has ${keys.length} variable(s).` };
    }
    case "fs": {
      try {
        const x = fs.readFileSync("/etc/passwd", "utf8");
        return { outcome: "allowed", detail: `Read ${x.length} bytes of /etc/passwd.` };
      } catch (e) {
        return { outcome: "blocked", detail: `readFileSync('/etc/passwd') -> ${(e as NodeJS.ErrnoException).code ?? "error"}` };
      }
    }
    case "spawn": {
      try {
        const cp = await import("node:child_process");
        const out = cp.execSync("id", { encoding: "utf8" });
        return { outcome: "allowed", detail: `Spawned a shell: ${out.trim()}` };
      } catch (e) {
        return { outcome: "blocked", detail: `execSync('id') -> ${(e as NodeJS.ErrnoException).code ?? "error"}` };
      }
    }
    case "net": {
      try {
        const res = await fetch("https://example.com/", { signal: AbortSignal.timeout(2500) });
        return { outcome: "allowed", detail: `Outbound request succeeded (HTTP ${res.status}). Network isolation is NOT active on this host.` };
      } catch (e) {
        const err = e as Error & { cause?: { code?: string } };
        return { outcome: "blocked", detail: `fetch('https://example.com') failed: ${err.cause?.code ?? err.name}` };
      }
    }
    case "loop": {
      for (;;) { /* burn CPU until the host kills us */ }
    }
    case "memory": {
      const hog: number[][] = [];
      for (;;) hog.push(new Array(1_000_000).fill(1));
    }
    default:
      return { outcome: "blocked", detail: "Unknown probe." };
  }
}

async function main() {
  const input = JSON.parse(await readStdin());
  if (input.mode === "backtest") {
    const report = runBacktest(input.spec, input.candles, { dataset: input.dataset, barsPerYear: input.barsPerYear });
    process.stdout.write(JSON.stringify({ ok: true, report }));
  } else if (input.mode === "probe") {
    process.stdout.write(JSON.stringify({ ok: true, probe: await probe(String(input.probe)) }));
  } else {
    process.stdout.write(JSON.stringify({ ok: false, error: "unknown mode" }));
  }
}

main().catch((e) => {
  process.stdout.write(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }));
  process.exitCode = 1;
});
