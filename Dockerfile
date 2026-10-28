# Single production image: the API also serves the built web app from the
# same origin (see WEB_DIST_DIR in api/src/app.module.ts).
#   docker build -t farm-management .

FROM node:24-slim AS base
RUN npm install -g pnpm@11.13.0

# --- web: static build ---
FROM base AS web
WORKDIR /app/web
COPY web/package.json web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY web/ ./
RUN pnpm build

# --- api: compile (needs dev dependencies) ---
FROM base AS api-build
WORKDIR /app/api
COPY api/package.json api/pnpm-lock.yaml api/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY api/ ./
RUN pnpm prisma generate && pnpm build

# --- api: production dependencies only ---
FROM base AS api-deps
WORKDIR /app/api
COPY api/package.json api/pnpm-lock.yaml api/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

# --- runtime ---
FROM node:24-slim
ENV NODE_ENV=production \
    PORT=3000 \
    WEB_DIST_DIR=/app/web
WORKDIR /app/api
COPY --from=api-deps /app/api/node_modules ./node_modules
COPY --from=api-build /app/api/dist ./dist
COPY --from=api-build /app/api/package.json ./
COPY --from=web /app/web/dist /app/web
USER node
EXPOSE 3000
CMD ["node", "dist/main"]
