// Refreshes the bundled REAL sample data from Binance's public, unauthenticated
// market-data endpoint (read-only candles; no account, no API key, no trading).
// Usage: npm run data:fetch
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "data");
mkdirSync(root, { recursive: true });
const BASE = "https://data-api.binance.vision/api/v3/klines";
const START = Date.UTC(2020, 0, 1);
const symbols = [
  { id: "btc-usd-1d", symbol: "BTCUSDT", name: "Bitcoin / USDT", blurb: "Daily candles, Jan 2020 onward" },
  { id: "eth-usd-1d", symbol: "ETHUSDT", name: "Ethereum / USDT", blurb: "Daily candles, Jan 2020 onward" },
  { id: "sol-usd-1d", symbol: "SOLUSDT", name: "Solana / USDT", blurb: "Daily candles, Sep 2020 onward" },
];
const meta = [];
for (const s of symbols) {
  const rows = [];
  let start = START;
  for (;;) {
    const res = await fetch(`${BASE}?symbol=${s.symbol}&interval=1d&startTime=${start}&limit=1000`);
    if (!res.ok) throw new Error(`${s.symbol}: HTTP ${res.status}`);
    const batch = await res.json();
    if (!batch.length) break;
    rows.push(...batch);
    start = batch[batch.length - 1][0] + 86400000;
    if (batch.length < 1000) break;
  }
  const csv = ["time,open,high,low,close,volume"]
    .concat(rows.map((r) => [new Date(r[0]).toISOString().slice(0, 10), r[1], r[2], r[3], r[4], Math.round(+r[5])].join(",")))
    .join("\n");
  writeFileSync(join(root, `${s.id}.csv`), csv + "\n");
  meta.push({ id: s.id, name: s.name, blurb: s.blurb, kind: "real", source: "Binance public market data (data-api.binance.vision), daily klines", barsPerYear: 365, file: `${s.id}.csv` });
  console.log(s.id, rows.length, "bars");
}
writeFileSync(join(root, "real.meta.json"), JSON.stringify(meta, null, 2) + "\n");
