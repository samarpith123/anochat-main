FROM node:24-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY lib/api-zod/package.json          ./lib/api-zod/
COPY lib/db/package.json               ./lib/db/
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY lib/api-spec/package.json         ./lib/api-spec/
COPY artifacts/api-server/package.json ./artifacts/api-server/

RUN pnpm install no-frozen-lockfile

FROM node:24-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY --from=deps /app/node_modules                       ./node_modules
COPY --from=deps /app/artifacts/api-server/node_modules  ./artifacts/api-server/node_modules
COPY . .

RUN pnpm --filter @workspace/api-server run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY --from=builder /app/artifacts/api-server/dist ./dist
COPY --from=deps    /app/node_modules/@supabase     ./node_modules/@supabase
COPY --from=deps    /app/node_modules/ws            ./node_modules/ws

EXPOSE 8080
CMD ["node", "dist/index.mjs"]
