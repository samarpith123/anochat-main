# Stage 1: install all workspace dependencies + create clean deploy bundle
FROM node:24-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY pnpm-workspace.yaml package.json ./
COPY lib/api-zod/package.json          ./lib/api-zod/
COPY lib/db/package.json               ./lib/db/
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY lib/api-spec/package.json         ./lib/api-spec/
COPY artifacts/api-server/package.json ./artifacts/api-server/

RUN pnpm install --no-frozen-lockfile

# Copy source so pnpm deploy can resolve workspace deps
COPY lib ./lib
COPY artifacts/api-server ./artifacts/api-server

# pnpm deploy creates a self-contained node_modules with all symlinks resolved
RUN pnpm --filter @workspace/api-server deploy --prod /app/deploy

# Stage 2: build the esbuild bundle
FROM node:24-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy full node_modules (including devDeps like esbuild)
COPY --from=deps /app/node_modules                      ./node_modules
COPY --from=deps /app/artifacts/api-server/node_modules ./artifacts/api-server/node_modules
COPY pnpm-workspace.yaml package.json ./
COPY lib ./lib
COPY artifacts/api-server ./artifacts/api-server

# Install zod directly in lib/api-zod so esbuild can find it
# This bypasses pnpm virtual store resolution issues entirely
RUN cd lib/api-zod && npm install --prefer-offline 2>/dev/null || npm install
RUN cd lib/db && npm install --prefer-offline 2>/dev/null || npm install

RUN pnpm --filter @workspace/api-server run build

# Stage 3: lean production image
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY --from=builder /app/artifacts/api-server/dist ./dist
# Use pnpm deploy output - clean node_modules, no broken symlinks
COPY --from=deps /app/deploy/node_modules ./node_modules

EXPOSE 8080
CMD ["node", "dist/index.mjs"]
