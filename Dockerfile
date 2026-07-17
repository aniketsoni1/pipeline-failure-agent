# Container image for the pipeline-agent CLI (CI-friendly, non-root).
FROM node:20-slim AS base
WORKDIR /app

# Install production deps first for layer caching.
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund || npm install --no-audit --no-fund

# Copy the source (aliases are resolved at runtime by tsx).
COPY tsconfig.json vitest.config.ts ./
COPY packages ./packages
COPY apps ./apps
COPY samples ./samples

# Drop privileges.
USER node

ENTRYPOINT ["node", "apps/cli/bin/pipeline-agent.mjs"]
CMD ["--help"]
