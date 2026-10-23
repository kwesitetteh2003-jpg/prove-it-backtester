# Pitch deck outline (PDF, required by default on lablab.ai)

The rule book says video **and slides as a PDF** are required unless the event changes the form. The Vultr page lists "Slide presentation" under Cover image and presentation, so assume it's required. Keep it to 10 slides, dark theme matching the app, large type, one idea per slide. Build in Google Slides/Keynote/Canva and export to PDF.

| # | Slide | Content (all claims must be true today) |
|---|---|---|
| 1 | Title | Prove-It Backtester. Tagline: "Don't trust the backtest. Prove it." Vultr Agent Rush, Track: Blast Radius Zero. Name, repo link, live URL. |
| 2 | Problem | Backtests are easy to flatter (look-ahead, few trades, lucky history, ignored costs, overfit rules). Retail traders get ideas from chats and videos and can't tell. Agents that execute work need provable containment. |
| 3 | Solution | Describe → Translate → Contain → Confront (four icons). One sentence each. |
| 4 | Live product | 2-3 real screenshots: builder, verdict "Not credible" with strategy vs buy-and-hold, honesty report. |
| 5 | The containment moment | Screenshot of the Containment Lab after "Run all six": six attacks, six outcomes. Layers: filesystem, spawn, environment, limits, network, lifecycle. State the network layer honestly as configured on your deployment. |
| 6 | Architecture on Vultr | Diagram: Browser → Caddy (HTTPS) → Docker container on a Vultr Cloud Compute VM (Fastify API → sandbox supervisor → disposable child process with no env/fs/spawn/net) ; host → Vultr Serverless Inference (only the host holds the key). Vultr Firewall + ufw around it. Mark Inference as live only if it is. |
| 7 | Business value | Who: self-directed traders, strategy/signal sellers, trading educators, and anyone building agents who must prove containment. How it could earn (hypotheses, label them as such): freemium plus paid tier or API. No invented market sizes. |
| 8 | Competition and originality | Categories: charting platforms with strategy testers, open-source backtesting libraries, algo-trading platforms. Differentiators: plain-English input, a credibility verdict instead of one curve, and attackable containment. Also acknowledge that the Vultr page lists "Prove-It" as an example direction, and say what you did beyond a bare version (eleven honesty checks, Containment Lab, sandbox replay). |
| 9 | Honest limits and roadmap | Daily bars, long-only, no leverage, single asset. Roadmap: walk-forward, shareable verdict cards, more templates, model-challenges-its-own-verdict, hourly data and shorts. |
| 10 | Thank you / links | Live URL, GitHub, video, contact. "Research tool, not financial advice." |

Cover image (16:9, optional but cheap): the verdict card ("Not credible, -41.8% vs +1,747.6%") on the app's dark background, with the Prove-It wordmark. Use a real screenshot, not a mock-up.
