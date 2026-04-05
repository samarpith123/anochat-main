# Stage 1: install all workspace dependencies
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

# Use pnpm deploy to create a clean, self-contained node_modules for api-server
# This resolves all symlinks properly - perfect for Docker
COPY lib ./lib
COPY artifacts/api-server ./artifacts/api-server
RUN pnpm --filter @workspace/api-server deploy --prod /app/deploy

# Stage 2: build the esbuild bundle
FROM node:24-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY lib ./lib
COPY artifacts/api-server ./artifacts/api-server
COPY pnpm-workspace.yaml package.json ./

RUN cd artifacts/api-server && node ./build.mjs

# Stage 3: lean production image
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Copy the built bundle
COPY --from=builder /app/artifacts/api-server/dist ./dist
# Copy the self-contained node_modules (all symlinks resolved by pnpm deploy)
COPY --from=deps /app/deploy/node_modules ./node_modules

EXPOSE 8080
CMD ["node", "dist/index.mjs"]
