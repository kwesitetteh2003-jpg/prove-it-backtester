# syntax=docker/dockerfile:1
# Prove-It Backtester: one image, one port (8787). Node 22 so the sandbox uses the stable `--permission` flag.

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci
COPY . .
# builds the sandbox runner bundle + server (tsc) + web (vite)
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=8787 HOST=0.0.0.0
WORKDIR /app
# util-linux provides `unshare`, used for the optional empty-network-namespace layer
RUN apt-get update && apt-get install -y --no-install-recommends util-linux && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci --omit=dev -w server --include-workspace-root=false
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/web/dist web/dist
COPY data data
# run as an unprivileged user
RUN useradd --system --uid 10001 --no-create-home prove && chown -R prove /app
USER prove
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:8787/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/dist/index.js"]
