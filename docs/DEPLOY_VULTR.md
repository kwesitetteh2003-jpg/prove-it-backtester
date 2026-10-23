# Deploying Prove-It on Vultr

Hackathon requirement: a Vultr VM backend and a public demo URL. This is one Docker container behind one port, so a small VM is enough.

> None of this was executed by the assistant that wrote the repo (no accounts were created). Steps are written from the Vultr UI and Docker conventions: verify each one as you go.

## 1. Create the VM

1. Sign up at vultr.com with the **new email** the hackathon asks for and claim the participant credit from the lablab page.
2. Deploy **Cloud Compute (Regular, 1 vCPU / 2 GB is plenty)**, Ubuntu 24.04 LTS, any region near your judges.
3. Add your SSH key. Do not use password login.

## 2. Firewall (this is part of the "blast radius" story)

Create a Vultr Firewall Group and attach it to the VM:

| Direction | Port | Source | Why |
|---|---|---|---|
| Inbound | 22 | your IP only | SSH |
| Inbound | 80, 443 | anywhere | public demo (via Caddy, step 5) |
| Inbound | 8787 | your IP only (optional) | direct debugging |

Vultr firewall groups filter inbound only. For outbound egress control use `ufw` on the VM (step 6).

## 3. Install Docker and run

```bash
ssh root@<vm-ip>
curl -fsSL https://get.docker.com | sh
git clone https://github.com/<you>/prove-it-backtester && cd prove-it-backtester
cp .env.example .env        # optional: edit to enable the LLM hook (step 4)
docker compose up -d --build
curl localhost:8787/api/health
```

The app already works with **no keys**: rule-based parser, bundled data.

## 4. Vultr Serverless Inference for the language-model hook (required for track 1)

1. In the Vultr customer portal open **Products -> Serverless Inference**, create a subscription and copy its API key.
2. List the models you can use: `curl -H "Authorization: Bearer $KEY" https://api.vultrinference.com/v1/models` and pick a chat model.
3. In `.env`:
   ```
   LLM_ENABLED=true
   LLM_BASE_URL=https://api.vultrinference.com/v1
   LLM_API_KEY=<paste, never commit>
   LLM_MODEL=<model id from /v1/models>
   ```
4. `docker compose up -d` again. The UI status pill changes from "Rule parser" to "LLM <model>", and `GET /api/config` shows `llm.enabled: true` and the model name (never the key).

The model only ever returns a JSON strategy that is validated against a strict schema. It never produces code and is not in the sandbox path. Any failure falls back to the rule parser.

Confirm the base URL and model names against Vultr's current docs before recording: they were taken from public docs and not tested with a live key.

## 5. HTTPS with Caddy (simplest public URL)

Point a domain (or a free `nip.io` name such as `203-0-113-7.nip.io`) at the VM, then:

```bash
apt-get install -y caddy
cat > /etc/caddy/Caddyfile <<'CADDY'
your-name.example.com {
  reverse_proxy 127.0.0.1:8787
}
CADDY
systemctl reload caddy
```

If you do this, change the compose port mapping to `"127.0.0.1:8787:8787"` so only Caddy can reach the app.

## 6. Egress lockdown (optional, recommended)

The sandbox holds no secrets and has no filesystem access, but a firewall on the VM makes "nowhere to go" true at the host level too:

```bash
ufw default deny outgoing && ufw default deny incoming
ufw allow in 22/tcp && ufw allow in 80,443/tcp
ufw allow out 53 && ufw allow out 443/tcp   # DNS + HTTPS (apt, inference API); tighten as you like
ufw enable
```

## 7. About the "network egress" layer, honestly

Each backtest runs in a child process started with Node's permission model (no fs, no spawn), an empty environment, a heap cap, an output cap and a wall-clock SIGKILL. Those layers are **always** on.

An additional layer, `unshare -rn` (empty network namespace), needs unprivileged user namespaces. **Docker's default seccomp profile blocks them**, so inside the default container this layer shows **"not available"** in the Containment Lab, and the "Phone home" attack reports the network is reachable. It does not pretend otherwise.

Ways to get it, in increasing order of risk:

1. **Run on the bare VM, not in Docker** (`npm ci && npm run build && npm start`, check with `unshare -rn true && echo ok`; on Ubuntu 24.04 unprivileged user namespaces are restricted by AppArmor and you may need `sysctl -w kernel.apparmor_restrict_unprivileged_userns=0`, which is a host-wide change). This gives the layer without weakening a container.
2. **Docker with `seccomp=unconfined`** (uncomment the line in `docker-compose.yml`). This works but removes a protection from the container itself. Only do this on a throwaway VM with the firewall above.
3. Leave it off. The remaining layers still deny file and process access, and the process has no credentials to exfiltrate.

Decide before the demo and make sure the Containment Lab shows what you will say out loud.

## 8. Updating and logs

```bash
git pull && docker compose up -d --build
docker compose logs -f proveit
```
