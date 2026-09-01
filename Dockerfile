FROM node:22-bookworm-slim

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY web/package.json ./web/package.json
COPY server/package.json ./server/package.json

RUN pnpm install --frozen-lockfile

COPY web ./web
COPY server ./server

RUN pnpm --filter @surket/web build
RUN pnpm --filter @surket/server build

ENV NODE_ENV=production
ENV PORT=8787
ENV SURKET_DB=/app/data/surket.db

RUN mkdir -p /app/data

EXPOSE 8787

CMD ["pnpm", "--filter", "@surket/server", "start"]