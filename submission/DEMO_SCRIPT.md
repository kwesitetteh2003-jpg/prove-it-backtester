# Demo video script: "Kofi's Telegram tip"

**Target length: 3:45 (hard limits 3:00 to 4:45).**
Why not 2 minutes: lablab's rule book scores presentation lower when the video is "less than 3 min" and expects the problem, solution, value proposition, market, future plans, and (for a top score) a competitive comparison, all in under 5 minutes. A 2-minute cut (shots 1-2, 3-6, 8, 11) is listed at the bottom as a fallback. The Vultr brief also requires **one containment moment** in the video; shot 8 is that moment.

Format: MP4 or MOV (rule book). Record at 1080p, browser at 100% zoom, dark mode as the app ships. Use the **deployed Vultr URL** in the address bar for shots 3-9 so judges see it is live on Vultr.

The character "Kofi" is fictional and should be introduced as an example, not a real user.

## Before you record (10-minute prep)
1. Open the deployed URL once to warm it up. Run each template once so nothing is cold.
2. In `/api/config` confirm the sandbox layers match what you will say. If "Network egress" is not enforced, keep the line in shot 8 that says so.
3. If the Vultr inference key is working, the status pill reads "LLM <model>". If it reads "Rule parser", **do not say a language model parsed the text** (use the "rules" narration variants marked [R]).
4. Numbers below come from the bundled data as of 23 Oct 2026 using the default costs (0.1% fee, 0.05% slippage per side). Re-run and read them off your screen before you say them. If you re-run `npm run data:fetch`, they change.

| Item | Value on 23 Oct 2026 |
|---|---|
| ETH run: strategy return | -41.8% (36 trades, 25% win rate, max drawdown -63%) |
| ETH run: buy-and-hold | +1747.6% |
| ETH bootstrap (500 reshuffles of the 36 trades) | median -45%, 5th-95th percentile -81% to +172% |
| BTC run (same rules): before / after 2024-10-07 | +6.3% before, -33.0% after (check "Stopped working in the later period" = fail) |
| BTC run: strategy vs hold | -28.8% vs +1029.9% |
| Containment Lab | env, fs, spawn, net: blocked; loop: killed after 1500 ms; memory: killed at 96 MB cap |

## Shot list and narration

| # | Time | On screen | Narration (read naturally, roughly 140 words per minute) |
|---|---|---|---|
| 1 | 0:00-0:20 | Phone/Telegram-style screenshot or simple title card: a chat message "Buy ETH when RSI drops below 30. Free money." Cut to Kofi's silhouette or just the text. | "Meet Kofi, an example user. A group chat says: buy Ethereum when RSI drops below 30, sell above 55, and you can't lose. He has savings he doesn't want to waste. His options: learn to code a backtest, or trust a chart someone else drew." |
| 2 | 0:20-0:40 | Landing page, hero line draws. Scroll the stats strip. | "Everybody can show you a strategy that would have made money. Prove-It tells you whether to believe it. And it does it as a safe agent: every run lives in one disposable sandbox on a Vultr server. It never touches an exchange, a wallet or a key." |
| 3 | 0:40-1:05 | Click **Launch the lab**. Click **Try: Ethereum dip**. The rules card fills in. | "Kofi types the tip in plain English. [LLM] A model on Vultr Serverless Inference turns it into typed rules. [R] The built-in parser turns it into typed rules. Look at the card: entry, exit, stop loss, fees and slippage, all explicit. The output is data checked against a strict schema. It is never code, so a model can't smuggle anything in." |
| 4 | 1:05-1:30 | Pick Ethereum, nudge the stop-loss slider, press **Run in sandbox**. Let the pipeline animation play. | "He presses run. Watch the pipeline: a fresh sandbox is created, it is fed data only, the backtest executes, and the sandbox is destroyed. Fresh process, empty environment, no disk, no shell, memory and time caps." |
| 5 | 1:30-2:05 | Results: verdict banner "Not credible", count-up metrics, strategy line vs buy-and-hold on the chart. | "Here is the answer. The tip lost about 42 percent. Just holding Ethereum over the same period was up about 1,700 percent. Thirty-six trades, a quarter of them winners, and a drawdown of 63 percent that almost nobody could sit through. Prove-It's verdict: **Not credible**." |
| 6 | 2:05-2:35 | Scroll the honesty report: highlight benchmark, drawdown and bootstrap rows. Then switch to Bitcoin, run again, and hover the chart at the out-of-sample shading. | "Eleven checks sit behind that verdict. No look-ahead: signals at the close, fills at the next open. And a bootstrap: shuffle those same trades five hundred times and the middle outcome is still a loss. On Bitcoin the rule made a little before October 2024 and lost a third after. That's what a rule that fits the past looks like. Kofi just saved his money." |
| 7 | 2:35-2:50 | Open the sandbox log replay under the results. | "And this is the exact event log of the sandbox that ran his test: created, fed, executed, destroyed. Not a diagram. The real run." |
| 8 | 2:50-3:20 | **Containment Lab** tab → **Run all six**. Pause on each outcome. **This is the containment moment.** Point at the layer list. | "But why trust the sandbox? Don't. Here are six real attacks: steal a secret from the environment, read the disk, spawn a shell, phone home, burn the CPU, eat the RAM. Secret: not found. Disk: access denied. Shell: denied. The runaway loop is killed by the host after one and a half seconds. The memory hog hits its cap and dies. [Net] The network call fails too. / [No net] The network layer isn't enabled on this host, and the lab says so instead of pretending." |
| 9 | 3:20-3:35 | Slide or split screen: architecture (see SLIDES_OUTLINE.md slide 6). | "Under the hood: a Vultr Cloud Compute VM runs the API and the sandbox supervisor, behind a Vultr firewall. Vultr Serverless Inference is the only model call, and its key never enters the sandbox." |
| 10 | 3:35-3:50 | Slide: value + what's next. | "Today it's a trust layer for retail strategies. Next: walk-forward tests, shareable verdict cards, and a model that challenges its own verdict with a stricter test, run in the same sandbox." |
| 11 | 3:50-4:00 | Logo/URL card with repo link and "Not financial advice". | "Prove-It. Don't trust the backtest. Prove it." |

(Shots sum to about 4:00, i.e. a 3:45 to 4:00 take at normal pace. If you run long, cut shot 7 and trim shot 6.)

## Business value, market and competition: where to say it
The rubric asks for market analysis, revenue and competitor comparison at the "strong/excellent" levels. Cover these in slides 7-8 (shots 9-10), not in the live demo. Only state what you can source; there are no measured users or revenue yet.
- Hypothesis, not data: retail traders and strategy sellers need an independent "does this hold up" check; a freemium web tool plus a paid tier for more data and history, or an API for educators and signal sellers, is one possible model.
- Competitor categories to name (verify current features before saying anything specific): general charting platforms with built-in strategy testers, open-source Python backtesting libraries, and algorithmic-trading platforms. The difference to claim: plain-English input, a verdict about whether to believe the result, and a contained execution you can attack live.

## Alternate narration if the LLM hook is not live
Replace shot 3's bracket with [R] and drop "on Vultr Serverless Inference" from shot 9 except to say it is **optional and planned**. Do not claim it. This will cost you on "Application of Technology" (see CHECKLIST gap G1); fixing it is better than hiding it.

## 2-minute fallback cut
Shots 1-2 compressed to 0:20, then 3, 4, 5 (shorter), 8 (shorter), 11. Expect a lower presentation score per the rule book; only use if a platform field forces it.

## Real vs. illustrative: say it honestly
- The landing-page terminal log is illustrative and captioned as such.
- "Kofi" and the group-chat tip are an example scenario.
- Everything in the Lab and Containment Lab is real execution.
