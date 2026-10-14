# syntax=docker/dockerfile:1
#
# Ask Away! — one image: PocketBase (API, realtime, database, migrations, hooks)
# serving the static Nuxt app. Data lives in the /pb_data volume.

ARG POCKETBASE_VERSION=0.40.5
ARG NODE_VERSION=24

# --- 1. Build the frontend -----------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY nuxt.config.ts tsconfig.json ./
COPY app ./app
COPY i18n ./i18n
COPY public ./public
RUN npx nuxt prepare && npm run build

# --- 2. Fetch PocketBase for the target platform -----------------------------------------
FROM alpine:3.22 AS pocketbase
ARG POCKETBASE_VERSION
ARG TARGETARCH
RUN apk add --no-cache curl unzip \
 && curl -fsSL -o /tmp/pb.zip \
    "https://github.com/pocketbase/pocketbase/releases/download/v${POCKETBASE_VERSION}/pocketbase_${POCKETBASE_VERSION}_linux_${TARGETARCH}.zip" \
 && unzip -q /tmp/pb.zip pocketbase -d /usr/local/bin \
 && chmod +x /usr/local/bin/pocketbase

# --- 3. Runtime ---------------------------------------------------------------------------
FROM alpine:3.22
ARG POCKETBASE_VERSION
LABEL org.opencontainers.image.title="Ask Away!" \
      org.opencontainers.image.description="Live Q&A, simple and tracking-free" \
      org.opencontainers.image.source="https://github.com/timothyoesch/askaway"

RUN apk add --no-cache ca-certificates tzdata \
 && adduser -D -H -u 10001 askaway \
 && mkdir -p /pb_data && chown askaway:askaway /pb_data

COPY --from=pocketbase /usr/local/bin/pocketbase /usr/local/bin/pocketbase
COPY pocketbase/pb_migrations /app/pb_migrations
COPY pocketbase/pb_hooks /app/pb_hooks
COPY --from=web /app/.output/public /app/pb_public
COPY docker/entrypoint.sh /usr/local/bin/askaway-entrypoint

ENV ASKAWAY_PUBLIC_DIR=/app/pb_public \
    POCKETBASE_VERSION=${POCKETBASE_VERSION}

USER askaway
EXPOSE 8090
VOLUME /pb_data

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:8090/api/health >/dev/null || exit 1

ENTRYPOINT ["/usr/local/bin/askaway-entrypoint"]
