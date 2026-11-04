FROM node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS builder

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ARG SOURCE_REVISION=development
ENV OFICINA_BUILD_ID=${SOURCE_REVISION}
# Optional build environment for local checks. The server handler reads the
# real backend origin at runtime; no rewrite or origin is compiled into client JS.
ARG INTERNAL_BACKEND_URL=http://backend:8080
ENV INTERNAL_BACKEND_URL=${INTERNAL_BACKEND_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN --mount=type=secret,id=next_actions_key \
    node scripts/build-container.mjs

FROM node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV INTERNAL_BACKEND_URL=http://backend:8080

ARG SOURCE_REVISION=development
LABEL org.opencontainers.image.source="https://github.com/uaikauaa/oficina" \
      org.opencontainers.image.revision=${SOURCE_REVISION}
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-* \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg

COPY --from=builder --chown=1001:1001 /app/public ./public
COPY --from=builder --chown=1001:1001 /app/.next/standalone ./
COPY --from=builder --chown=1001:1001 /app/.next/static ./.next/static
COPY --chown=1001:1001 docker-entrypoint.mjs ./docker-entrypoint.mjs

USER 1001:1001
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:${PORT:-3000}/ || exit 1

CMD ["node", "docker-entrypoint.mjs"]
