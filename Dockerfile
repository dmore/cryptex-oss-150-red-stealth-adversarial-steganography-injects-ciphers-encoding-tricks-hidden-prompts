# Cryptex — static SvelteKit build served by nginx on port 80.
#
# Multi-stage:
#   1. node:20-alpine builder  → compiles app/ into app/build/ (static output)
#   2. nginx:1.27-alpine       → serves the static bundle with strict CSP +
#                                SPA routing + 7d/1y cache tiers.
#
# The Python CLI (cryptex_cli/) is NOT part of this image — run it locally with
# `uv`. The web image is the deploy target for Dokploy / Coolify / plain Docker.
#
# Build-time args (override in docker-compose / Dokploy "Build Variables"):
#   BASE_PATH              — subpath for the app (e.g. "/cryptex"). Empty for root.
#   PUBLIC_ADSENSE_CLIENT  — optional Google AdSense publisher id (ca-pub-XXXX…).
#                            Unset = no ads, no consent banner, no Google script.

# ---------- Stage 1: build the SvelteKit app ----------
FROM node:20-alpine AS builder
WORKDIR /build

# Build arguments (must be declared before first use)
ARG BASE_PATH=""
ARG PUBLIC_ADSENSE_CLIENT=""

# Expose them as environment variables so Vite's build step inlines them
# into the static output.
ENV BASE_PATH=${BASE_PATH} \
    PUBLIC_ADSENSE_CLIENT=${PUBLIC_ADSENSE_CLIENT}

# The SvelteKit build reads transformers from ../src/transformers via a Vite
# alias, so we bring both trees into the build context.
COPY src/transformers ./src/transformers
COPY app/package*.json ./app/

# Install only production + dev deps needed for the build.
RUN cd app && npm ci --no-audit --no-fund --prefer-offline

COPY app ./app

# Produce the static output at /build/app/build/
RUN cd app && npm run build

# Strip source-map and other non-runtime bits to shrink the image.
RUN find /build/app/build -name '*.map' -type f -delete

# ---------- Stage 2: nginx runtime ----------
FROM nginx:1.27-alpine

# Security hardening + tiny footprint
RUN apk update && apk upgrade --no-cache && \
    rm -rf /var/cache/apk/* && \
    # Remove the default site so only ours is served
    rm -f /etc/nginx/conf.d/default.conf

COPY --from=builder /build/app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

# OCI image metadata — shows up in Dokploy / registry UIs
LABEL org.opencontainers.image.title="Cryptex" \
      org.opencontainers.image.description="AI red-teamer's text lab — 162 transforms, steganography, BYOK AI rewrites." \
      org.opencontainers.image.url="https://github.com/m4xx101/cryptex" \
      org.opencontainers.image.source="https://github.com/m4xx101/cryptex" \
      org.opencontainers.image.licenses="MIT"

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
