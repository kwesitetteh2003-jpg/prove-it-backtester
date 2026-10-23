// Generates clearly-labelled SYNTHETIC datasets (seeded, reproducible).
// They exist so the app works offline and so you can see how a strategy behaves
// in a regime you pick (trend / chop / crash-and-recover). They are NOT real prices.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "data");

function rng(seed) { // mulberry32
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function gauss(r) { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

function make({ id, name, blurb, seed, bars, start, regimes }) {
  const r = rng(seed); let price = 100; const rows = []; let t = Date.UTC(...start);
  let ri = 0, left = regimes[0].len;
  for (let i = 0; i < bars; i++) {
    if (left-- <= 0) { ri = (ri + 1) % regimes.length; left = regimes[ri].len; }
    const { mu, sigma } = regimes[ri];
    const ret = mu + sigma * gauss(r);
    const open = price; const close = Math.max(1, open * Math.exp(ret));
    const wick = Math.abs(gauss(r)) * sigma * 0.6;
    const high = Math.max(open, close) * (1 + wick * r()); const low = Math.min(open, close) * (1 - wick * r());
    rows.push([new Date(t).toISOString().slice(0, 10), open, high, low, close, Math.round(1e5 * (1 + r()))]);
    price = close; t += 86400000;
  }
  const csv = "time,open,high,low,close,volume\n" + rows.map((x) => x.map((v, k) => (k && k < 5 ? v.toFixed(2) : v)).join(",")).join("\n") + "\n";
  writeFileSync(join(root, `${id}.csv`), csv);
  return { id, name, blurb, kind: "synthetic", source: "Synthetic: seeded random walk with regime switching. Not real prices.", barsPerYear: 365, file: `${id}.csv` };
}

const meta = [
  make({ id: "synth-trend-1d", name: "Synthetic: steady uptrend", blurb: "Persistent drift with moderate noise", seed: 11, bars: 1000, start: [2021, 0, 1],
    regimes: [{ mu: 0.0016, sigma: 0.02, len: 200 }, { mu: -0.0005, sigma: 0.025, len: 60 }] }),
  make({ id: "synth-chop-1d", name: "Synthetic: sideways chop", blurb: "No drift, mean-reverting-looking noise", seed: 23, bars: 1000, start: [2021, 0, 1],
    regimes: [{ mu: 0.0001, sigma: 0.022, len: 120 }, { mu: -0.0001, sigma: 0.018, len: 120 }] }),
  make({ id: "synth-crash-1d", name: "Synthetic: crash and recovery", blurb: "Boom, deep drawdown, slow recovery", seed: 37, bars: 1000, start: [2021, 0, 1],
    regimes: [{ mu: 0.002, sigma: 0.022, len: 250 }, { mu: -0.006, sigma: 0.035, len: 80 }, { mu: 0.0004, sigma: 0.02, len: 300 }, { mu: 0.0015, sigma: 0.025, len: 100 }] }),
];
writeFileSync(join(root, "synthetic.meta.json"), JSON.stringify(meta, null, 2) + "\n");
console.log("wrote", meta.map((m) => m.id).join(", "));
