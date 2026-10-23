# Prove-It Backtester: submission copy

Paste-ready text for the lablab.ai form. Everything here matches what the code does today. Nothing below is an invented number. Figures quoted from the demo run come from the bundled data and can be reproduced (see DEMO_SCRIPT.md).

## Title
**Prove-It Backtester**

## Tagline (one line)
Describe a trading idea in plain English. A throw-away sandbox runs it. Honesty checks tell you whether to believe the result.

## Short description (~50 words)
Prove-It turns a plain-English trading idea into typed rules, runs the backtest inside a disposable sandbox with no secrets, no disk, no shell and no network, and returns results beside buy-and-hold with a verdict: Not credible, Inconclusive or Holds up. A Containment Lab fires six real attacks at the sandbox live.

(≈ 50 words. If the form has a character cap, cut the last sentence.)

## Long description

### Problem
Anyone can show a chart where a strategy "would have made money". Backtests are easy to flatter: look-ahead bias, too few trades, a lucky stretch of history, ignored fees, or a rule tuned until it fits the past. Retail traders get strategy ideas from chat groups and videos, and the tools that test them either need coding skill or hand back one flattering equity curve with no warning about how little it proves.

There is a second problem for anyone building agents that run work for users: the moment a system executes something on a user's behalf, you need to show that it cannot reach secrets, the disk, the network, or run forever.

### Solution
Prove-It is a web app with a four-step pipeline:

1. **Describe.** The user types an idea such as "Buy Ethereum when RSI(14) drops below 30, sell above 55, stop loss 8%."
2. **Translate.** The text becomes a small typed rule set (`StrategySpec`) that is validated by a strict schema. A built-in rule parser handles moving-average crossovers, RSI mean reversion and channel breakouts without any key. An optional OpenAI-compatible language model (Vultr Serverless Inference) can write the same JSON for freer phrasing. Either way the output is data, never code, and any model failure falls back to the rule parser.
3. **Contain.** Each run gets a fresh child process under Node's permission model: no filesystem access, no process spawn, an empty environment (no keys exist inside), a heap cap, an output cap, a wall-clock SIGKILL, and a scratch directory destroyed afterwards. Where the host allows it, it also runs in an empty network namespace. The UI replays the sandbox event log for the run.
4. **Confront.** The report shows returns, max drawdown, win rate, Sharpe, profit factor and fees next to buy-and-hold on the same bars, then runs 11 honesty checks (no look-ahead, data kind, trade count, history length, beats buy-and-hold, drawdown depth, first-70%-vs-last-30% split, parameter nudges, doubled trading costs, one-lucky-trade concentration, 500-reshuffle bootstrap) and gives a verdict.

A **Containment Lab** tab runs six hostile programs in the same kind of sandbox: read a planted canary secret, read `/etc/passwd`, spawn a shell, call out to the internet, spin the CPU forever, and allocate memory until it breaks. Each result is the real outcome on the host it runs on, including "network reachable" if the host cannot isolate the network.

Prove-It never connects to an exchange, never places a trade, and never asks for an API key or wallet. It is a research tool, not financial advice.

### How it uses Vultr
- **Vultr Cloud Compute VM** hosts the backend: the API, the sandbox supervisor and the web app (one Docker container, one port, fronted by Caddy for HTTPS). *[Fill in once deployed: VM plan, region.]*
- **Vultr Firewall + `ufw`** restrict inbound ports and outbound egress at the host level, so "nowhere to go" is also true outside the sandbox.
- **Vultr Serverless Inference** (`https://api.vultrinference.com/v1`, OpenAI-compatible) is the language-model hook that turns a free-form sentence into the strategy JSON. It is off until a key is configured. *[Only keep this section as a claim once it has been run with a live key and shown in the demo. See CHECKLIST.md gap G1.]*
- The sandbox holds no credentials by design: the Vultr inference key lives only in the host process environment and is never passed into the sandbox or returned by the API.

### Tech stack
Node 20.10+/22, TypeScript, Fastify, zod; custom backtest engine and indicator library; Node permission model + `unshare -rn` for sandboxing; React 19, Vite, Tailwind CSS v4, Framer Motion, hand-written SVG charts; Vitest (40 tests); Docker + Docker Compose; Caddy; Vultr Cloud Compute, Vultr Firewall, Vultr Serverless Inference. Market data: bundled daily candles for BTC, ETH and SOL from Binance's public keyless market-data endpoint, plus clearly labelled synthetic datasets and CSV upload.

Suggested tags: AI agents, sandboxing, code execution safety, fintech, backtesting, Vultr, Serverless Inference, TypeScript, React, Docker.

### Challenges
- **Making "contained" mean something.** The first design question was what to promise. We kept the claim narrow and testable: each layer reports whether it is actually enforced on the current host, and the Containment Lab runs real attacks instead of showing a diagram.
- **Honest isolation limits.** The empty network namespace needs unprivileged user namespaces, which Docker's default seccomp profile blocks. The app reports that layer as "not available" in that case rather than hiding it. Choosing between bare-VM, Docker, or relaxed seccomp is a documented deployment decision.
- **Backtests that do not lie.** Fills happen at the next bar's open, stops assume the pessimistic order within a bar, the benchmark pays the same costs, and checks that can't be meaningful (e.g. stress-testing a losing strategy) say they were skipped.
- **Keeping the language model on a leash.** It may only emit JSON that survives a strict schema. It never writes code and sits outside the sandbox path.

### Limitations (stated in the app and README)
Daily bars only; long-only, no leverage, no funding or order-book model; one asset per run; the 70/30 split is a consistency check, not walk-forward optimisation. Sandboxing reduces risk and is not a proof of safety. The LLM hook has not yet been exercised against a live Vultr key (update this line once it has). The Docker image has not been built or run by the authors of the repo's tooling yet (no Docker on the build box).

### What's next
Trade-by-trade drawer and shareable report links; PDF/PNG verdict cards; more templates (MACD, Bollinger, dollar-cost averaging) and a "combine two rules" builder; walk-forward testing; hourly data and short selling with funding costs; a "challenge the verdict" mode where the model proposes a stricter test that then runs inside the sandbox; model-written explanations of the verdict (see CHECKLIST.md gap G2).

## Things NOT to claim
- Don't say "Docker-per-run" containers; each run is a child process under the Node permission model (the Docker container wraps the whole app).
- Don't say the language model is integrated until you have run it with a live Vultr key.
- Don't promise profit, accuracy or "AI-powered trading". The product's point is the opposite.
- Don't quote market size, revenue or user numbers; none have been measured.
