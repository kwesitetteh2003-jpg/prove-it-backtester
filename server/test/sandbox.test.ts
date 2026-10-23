import { beforeAll, describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { runInSandbox, RUNNER_PATH } from "../src/sandbox/host.js";
import { runBacktest } from "../src/engine/index.js";
import { buildFromTemplate, bars, ds, walk } from "./helpers.js";

beforeAll(() => { if (!existsSync(RUNNER_PATH)) throw new Error("Run `node scripts/build-runner.mjs` first."); });

describe("sandbox", () => {
  it("returns the same report as the in-process engine", async () => {
    const candles = bars(walk(400, 7), { spread: 0.01 });
    const spec = buildFromTemplate("ma_cross", { fast: 5, slow: 20 });
    const r = await runInSandbox({ mode: "backtest", spec, candles, dataset: ds, barsPerYear: 365 });
    expect(r.error).toBeUndefined();
    const local = runBacktest(spec, candles, { dataset: ds, barsPerYear: 365 });
    expect(r.output.report.equity).toEqual(local.equity);
    expect(r.meta.events.map((e) => e.stage)).toContain("destroy");
    expect(r.meta.exitCode).toBe(0);
  });
  it("re-validates specs inside the sandbox", async () => {
    const candles = bars(walk(100), {});
    const r = await runInSandbox({ mode: "backtest", spec: { nope: true }, candles, dataset: ds, barsPerYear: 365 });
    expect(r.output).toBeNull();
    expect(r.error).toBeTruthy();
  });
  it("cannot see host environment secrets", async () => {
    process.env.PROVEIT_CANARY_SECRET = "x";
    const r = await runInSandbox({ mode: "probe", probe: "env" });
    expect(r.output.probe.outcome).toBe("blocked");
  });
  it("cannot read the filesystem or spawn processes", async () => {
    expect((await runInSandbox({ mode: "probe", probe: "fs" })).output.probe.outcome).toBe("blocked");
    expect((await runInSandbox({ mode: "probe", probe: "spawn" })).output.probe.outcome).toBe("blocked");
  });
  it("kills runaway CPU after the wall-clock limit", async () => {
    const r = await runInSandbox({ mode: "probe", probe: "loop" }, {}, { wallMs: 700 });
    expect(r.meta.killedBy).toBe("timeout");
    expect(r.error).toMatch(/Killed/);
  });
  it("kills a memory hog at the heap cap", async () => {
    const r = await runInSandbox({ mode: "probe", probe: "memory" }, { heapMb: 64 }, { wallMs: 10000 });
    expect(r.output).toBeNull();
    expect(r.meta.killedBy).toBeNull(); // died on its own at the cap, not by timeout
    expect(r.error).toMatch(/memory/i);
  });
});
