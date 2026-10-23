# Setup: run locally and deploy on Vultr

Nothing here has been run on a Vultr account (none exists yet). Local steps were run on the build box (Node 20.19.2): `npm install`, `npm run build`, `npm test` (40/40 pass), `npm start`, and the API endpoints responded. The Docker image and the Vultr steps are **untested**: verify each as you go.

## A. Run locally

Requirements: Node 20.10+ (22 recommended), npm. No keys needed.

```bash
git clone https://github.com/<you>/prove-it-backtester && cd prove-it-backtester
npm install
npm run dev          # API on http://localhost:8787, web on http://localhost:5173
```

Production-style, one port:

```bash
npm run build
npm start            # http://localhost:8787  (set PORT=xxxx to change)
npm test             # 40 tests: engine, parser, sandbox containment, API
```

Smoke test:

```bash
curl localhost:8787/api/health
curl localhost:8787/api/config      # shows sandbox layers + whether the LLM hook is on
```

Refresh market data (optional; changes the numbers quoted in the demo script): `npm run data:fetch`. Synthetic sets: `npm run data:synth`.

## B. Get the Vultr pieces (Rufus does these)

1. Create a Vultr account with an email **never used on Vultr before** (lablab requirement).
2. Redeem the **$200 gift code** (Billing → Promotions → Gift Code). The code is shared at kickoff (Nov 3), so credits appear then. Until then you'd need a card to deploy early.
3. In the Vultr console create a **Serverless Inference** subscription/API key. Public docs: https://api.vultrinference.com/docs (the model list is public: `curl https://api.vultrinference.com/v1/models`; the docs' default is `deepseek-v4.1-flash`).
4. Keep the key out of git. It goes only in the server's `.env`.

## C. Deploy on a Vultr VM (Docker)

Full details with firewall, HTTPS and egress lockdown are in `docs/DEPLOY_VULTR.md`. Short version:

```bash
# 1. In the Vultr console: Cloud Compute, Regular, 1 vCPU / 2 GB, Ubuntu 24.04, your SSH key.
#    Attach a Firewall Group: 22 from your IP only; 80 and 443 from anywhere.
ssh root@<vm-ip>
curl -fsSL https://get.docker.com | sh
git clone https://github.com/<you>/prove-it-backtester && cd prove-it-backtester
cp .env.example .env
nano .env            # set LLM_ENABLED=true, LLM_API_KEY=..., LLM_MODEL=<id from /v1/models>
docker compose up -d --build
curl localhost:8787/api/health
curl localhost:8787/api/config      # expect llm.enabled true and the model name, never the key
```

HTTPS: point a domain (or `<ip-with-dashes>.nip.io`) at the VM, install Caddy, reverse-proxy to `127.0.0.1:8787`, and change the compose port to `"127.0.0.1:8787:8787"`.

Egress lock (optional): `ufw` rules in `docs/DEPLOY_VULTR.md` step 6. Keep outbound 443 open for the inference API.

## D. Decide the network-isolation layer BEFORE recording

In default Docker the `unshare -rn` layer shows "not available" and the "Phone home" probe reports the network is reachable. Options (details and risks in `docs/DEPLOY_VULTR.md` step 7):

1. Run on the bare VM (`npm ci && npm run build && npm start` under a systemd unit) and check `unshare -rn true && echo ok` (Ubuntu 24.04 may need an AppArmor sysctl).
2. Docker with `seccomp=unconfined` on a throwaway VM behind the firewall.
3. Leave it off and say so out loud in the video.

The judges' brief emphasises "process isolation", "secret hygiene", "resource limits" and "lifecycle discipline". Prove-It's other four layers cover those. A Docker-based layer is "strongly recommended" by the organizers, so the Docker deployment is the natural default; just be accurate on camera.

## E. Pre-submission verification on the deployed URL

- [ ] Open the public URL in a private window; the landing page loads.
- [ ] `/api/config` shows `llm.enabled: true` (if you are claiming Serverless Inference).
- [ ] Run "Buy Ethereum when RSI(14) drops below 30, sell above 55, stop loss 8%" → Not credible verdict.
- [ ] Containment Lab → Run all six → read each outcome, and check the "Net isolated" pill matches what you say.
- [ ] Repo is public, `.env` is not in it (`git log --all -- .env` returns nothing), README matches reality.
- [ ] Rate limits: 40 backtests/min/IP and 4 concurrent sandboxes. Don't let judges hit a 429 or 503 during your demo; warm the page before the video.
