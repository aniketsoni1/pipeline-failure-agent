# Container image for the pipeline-agent CLI (CI-friendly, non-root).
FROM node:20-slim AS base
WORKDIR /app

# Install deps. The dev entrypoint runs TypeScript via the tsx loader, so we do
# NOT use --omit=dev here (tsx must be present at runtime).
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund

# Copy only what the CLI needs at runtime (tsconfig provides the @pfa/* aliases).
COPY tsconfig.json ./
COPY packages ./packages
COPY apps ./apps

# Drop privileges.
USER node

ENTRYPOINT ["node", "apps/cli/bin/pipeline-agent.mjs"]
CMD ["--help"]
