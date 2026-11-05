# Prove-It Backtester

**Prove it before you risk it.** Describe a trading idea in plain English. Prove-It turns it into rules, runs it in a throw-away sandbox over historical prices, and gives back a verdict that tells you where the result is flattering you.

Built for the **Vultr Agent Rush** hackathon (lablab.ai), track **"Blast Radius Zero"**: an agent-style product whose work runs inside a sandbox on a Vultr VM.

> It never places trades, never connects to an exchange, never asks for an API key or a wallet. It is a research tool, not financial advice.

## What it does

1. **Describe.** "Buy Ethereum when RSI(14) drops below 30, sell above 55, stop loss 8%."
2. **Translate.** The text becomes a small, typed rule set (`StrategySpec`). A rule-based parser handles moving-average crossovers, RSI mean reversion and channel breakouts with no key. An optional OpenAI-compatible LLM (Vultr Serverless Inference) can write the same JSON for freer phrasing. Either way the output is **data validated by a schema, never code**.
3. **Contain.** Every run gets a fresh child process: Node permission model (no filesystem, no process spawn), empty environment, heap cap, output cap, wall-clock SIGKILL, scratch directory destroyed afterwards. Where the host allows it, it also runs in an empty network namespace.
4. **Confront.** Returns, max drawdown, win rate, Sharpe, profit factor and fees, always beside buy-and-hold on the same bars, then a battery of 11 honesty checks that produce a verdict: **Not credible / Inconclusive / Holds up**.

### Honesty checks
No look-ahead (signals at close, fills at the next open) · data kind (real / synthetic / yours) · trade count · history length · beats buy-and-hold · drawdown depth · first 70% vs last 30% of history · parameter nudges (20-25% shifts re-run) · 2x trading costs · one-lucky-trade concentration · bootstrap (500 reshuffles of the trades).

### Containment Lab
A tab where you fire six real hostile programs at the same kind of sandbox: read a planted canary secret from the environment, read `/etc/passwd`, `execSync('id')`, `fetch('https://example.com')`, an infinite loop, a memory hog. Each result is the real outcome on this host, including "network reachable" if the host can't isolate it.

## Architecture

```
web/  (Vite + React 19 + TS + Tailwind v4 + Framer Motion, custom SVG charts)
  #/      landing page
  #/lab   builder -> pipeline animation -> results | containment lab
      |  JSON over HTTP
server/ (Node + Fastify + zod)
  src/engine/    strategy spec, parser, indicators, backtester, metrics, honesty analysis
  src/sandbox/   host.ts (spawns + supervises)   runner.ts (bundled to dist/runner.cjs, zero deps)
  src/llm/       optional OpenAI-compatible client, validated, falls back to rules
  src/app.ts     API, rate limit (per IP), concurrency cap, 3 MB body limit, serves web/dist
data/   bundled daily candles (real + synthetic, each labelled) and CSV meta
```

Engine rules: long-only, no leverage, one position at a time; entry conditions are ANDed and exit conditions ORed; stops and take-profits trigger on intrabar high/low; fee and slippage are charged per side; the benchmark pays the same costs.

Run-time flow: `POST /api/backtest` -> validate spec -> spawn sandbox (empty env, permission model) -> send `{spec, candles}` as JSON on stdin -> sandbox returns the report -> host kills and cleans up -> honesty verdict returned with the sandbox event log (the UI replays it).

## Run it

Requires Node 20.10+ (Node 22 recommended; the code uses `--permission` on 22+ and `--experimental-permission` on 20).

```bash
npm install
npm run dev            # API on :8787, web on :5173 (proxied)
```

Production-style (one port):

```bash
npm run build
npm start              # http://localhost:8787
npm test               # 40 tests: engine, parser, sandbox containment, API
```

Docker:

```bash
docker compose up -d --build     # http://localhost:8787
```

Refresh the real market data (public, read-only, keyless Binance market-data endpoint): `npm run data:fetch`. Regenerate the synthetic sets: `npm run data:synth`.

### Environment (all optional, see `.env.example`)

| Var | Purpose |
|---|---|
| `VULTR_INFERENCE_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`, `LLM_ENABLED` | Vultr Serverless Inference parser. On when the key is set; falls back to the rule parser on any error |
| `SANDBOX_TIMEOUT_MS`, `SANDBOX_HEAP_MB` | sandbox caps (20 s / 256 MB) |
| `MAX_CONCURRENT_SANDBOXES`, `RATE_LIMIT_PER_MIN` | abuse limits |
| `SANDBOX_NET_ISOLATION=off` | skip the network-namespace layer |

No secret is committed; keys are read from the environment only and never returned by the API.

## Real vs mocked: be upfront about this

| Thing | Status |
|---|---|
| Backtest engine, metrics, honesty checks | Real code, unit tested |
| Sandbox (permission model, empty env, caps, kill, cleanup) | Real. The Containment Lab runs real attacks |
| Network isolation (`unshare -rn`) | Real **when the host allows it**. Not available under Docker's default seccomp profile (see `docs/DEPLOY_VULTR.md`) and reported as such |
| BTC / ETH / SOL history | Real daily candles from Binance's public market-data endpoint, bundled as CSV. No account or key was used |
| "Synthetic" datasets | Generated by a seeded random process, labelled SYNTHETIC in the UI and in every report |
| LLM parsing | Optional and **off by default**. Not tested against a live Vultr key (none exists yet) |
| Trading | **None.** Nothing is ever sent to an exchange |
| The landing page terminal log | Illustrative, captioned as such. The Lab runs the real thing |

## Limits of backtesting (the app says these too)

- A backtest is a story about the past, not a forecast. One asset, one path of history.
- Many tries on the same data will eventually find something that looks great (overfitting). The checks make this visible; they cannot remove it.
- Daily bars only. Intrabar order is unknown: when a stop and take-profit could both trigger in a bar, the engine assumes the stop first (the pessimistic choice).
- Long-only, no leverage, no funding, no liquidity or order-book model. Slippage is a flat percentage.
- The first-70% vs last-30% check is a fixed-rule consistency check, **not** walk-forward optimisation.
- Sandboxing reduces risk; it is not a proof of safety. The layers depend on the host.

## 2-minute demo script

| Time | Do | Say |
|---|---|---|
| 0:00 | Landing page, let the hero line draw | "Everybody can tell you a strategy would have made money. Prove-It tells you whether to believe it." |
| 0:15 | Scroll the stats strip, click **Launch the lab** | "Zero exchange connections. Every run lives in one disposable sandbox." |
| 0:25 | Click **Try: Ethereum dip**; rules card fills in | "I type an idea in English. It becomes typed rules. A model can write them, but it can only emit data, never code." |
| 0:40 | Nudge a slider, choose Ethereum, press **Run in sandbox**; watch the pipeline | "Here the run is created, fed data only, executed, and destroyed." |
| 0:55 | Results: verdict, count-up metrics | "Minus 42% against plus 1,700% for just holding. Prove-It says **Not credible**." |
| 1:10 | Hover the chart, toggle Log, show the out-of-sample shading | "It stopped working in the later period, which is what a rule that fits the past looks like." |
| 1:25 | Scroll to the honesty report, open the sandbox log replay | "Eleven checks. And this is the exact log of the sandbox that ran it." |
| 1:35 | **Containment lab**, **Run all six** | "Don't trust me. Here are six real attacks: steal a secret, read the disk, spawn a shell, phone home, burn the CPU, eat the RAM." |
| 1:55 | Point at the layer list | "Blast radius zero, and we show you which layers are on, honestly." |

Tips: use the Bitcoin trend example to show a *Holds up / Inconclusive* case for contrast. Before recording, check the "Net isolated" pill in the lab matches what you intend to say.

## What Rufus needs to do next

### Before the demo
- [ ] Read the code. `server/src/engine/*` is the heart; `server/src/sandbox/host.ts` is the sandbox.
- [ ] `npm install && npm run build && npm test`, then `npm start` and click through everything once.
- [ ] Get a Vultr account with the **new email** the hackathon requires; claim the $200 credit.
- [ ] Create a Vultr Serverless Inference key; set `LLM_ENABLED=true`, `LLM_API_KEY`, `LLM_MODEL` in `.env` (never commit it). Required to count for track 1.
- [ ] Deploy on a Vultr VM following `docs/DEPLOY_VULTR.md`; get a public URL; decide on the network-isolation layer.
- [ ] Rerun the 2-minute demo script against the **deployed** URL.

### Polish ideas if time remains
- Trade-by-trade detail drawer; shareable report link; PDF/PNG export of the verdict card.
- More templates (MACD, Bollinger, dollar-cost averaging) and a "combine two rules" builder.
- Walk-forward testing instead of the single 70/30 split.
- Hourly data and short selling, with funding costs.
- A "challenge the verdict" mode that asks the LLM to propose a stricter test and runs it in the sandbox.
- Real screenshots/GIF at the top of this README.

### Submission checklist (all times Accra, UTC+0)
- [ ] **Register on lablab.ai before Nov 3, 15:00.**
- [ ] Public GitHub repo (push this folder; check `.env` is not in it).
- [ ] Backend running on a Vultr VM, public demo URL working.
- [ ] Uses Vultr Serverless Inference (track 1 requirement).
- [ ] Demo video recorded (use the script above).
- [ ] Cover image, short and long description, tech tags, and links filled in on the lablab submission form.
- [ ] **Submit before Nov 8, 22:00.** Leave a few hours of buffer.
- [ ] Re-check the rule book for team size, country eligibility and any extra requirements.

## Repository layout

```
Dockerfile  docker-compose.yml  .env.example
docs/DEPLOY_VULTR.md
scripts/            fetch-data.mjs, make-synthetic.mjs
data/               bundled CSVs
server/             engine, sandbox, API, tests
web/                UI
```

MIT license. Market data courtesy of Binance public market-data endpoints; check their terms before redistributing at scale.
