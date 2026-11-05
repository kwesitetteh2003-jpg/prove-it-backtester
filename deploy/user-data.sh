#!/bin/bash
# Vultr cloud-init user-data (Ubuntu 24.04). Paste into "Cloud-Init User-Data" when deploying,
# or run as root on a fresh VM: curl -fsSL https://raw.githubusercontent.com/kwesitetteh2003-jpg/prove-it-backtester/main/deploy/user-data.sh | bash
# The app runs under systemd on port 80. Optional key: put VULTR_INFERENCE_API_KEY=... in /etc/prove-it.env
set -euxo pipefail
export DEBIAN_FRONTEND=noninteractive
REPO=${REPO:-https://github.com/kwesitetteh2003-jpg/prove-it-backtester.git}
apt-get update -y
apt-get install -y ca-certificates curl git
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
id prove-it >/dev/null 2>&1 || useradd --system --home /opt/prove-it --shell /usr/sbin/nologin prove-it
if [ -d /opt/prove-it/.git ]; then git -C /opt/prove-it pull --ff-only; else git clone --depth 1 "$REPO" /opt/prove-it; fi
cd /opt/prove-it
npm ci
npm run build
npm test
chown -R prove-it:prove-it /opt/prove-it
[ -f /etc/prove-it.env ] || printf 'VULTR_INFERENCE_API_KEY=\nLLM_MODEL=\n' > /etc/prove-it.env
chmod 600 /etc/prove-it.env
cat > /etc/systemd/system/prove-it.service <<'UNIT'
[Unit]
Description=Prove-It Backtester
After=network-online.target
Wants=network-online.target

[Service]
User=prove-it
WorkingDirectory=/opt/prove-it
Environment=NODE_ENV=production PORT=80 HOST=0.0.0.0
EnvironmentFile=-/etc/prove-it.env
ExecStart=/usr/bin/node server/dist/index.js
Restart=on-failure
AmbientCapabilities=CAP_NET_BIND_SERVICE
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/opt/prove-it /tmp
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now prove-it
if command -v ufw >/dev/null; then ufw allow 22/tcp; ufw allow 80/tcp; ufw --force enable; fi
