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
#   PUBLIC_GA_ID           — optional Google Analytics 4 measurement id (G-XXXXXXXX).
#                            Unset = no analytics, no gtag script, no events.

# ---------- Stage 1: build the SvelteKit app ----------
FROM node:20-alpine AS builder
WORKDIR /build

# Build arguments (must be declared before first use)
ARG BASE_PATH=""
ARG PUBLIC_ADSENSE_CLIENT=""
ARG PUBLIC_GA_ID=""
# Supabase auth (D4). When unset, defaults are empty — the auth stack falls
# back to local-only mode (no breaking change to existing deploys). Set all
# three to enable sign-in: VITE_AUTH_ENABLED=true + the two PUBLIC_SUPABASE_*.
ARG VITE_AUTH_ENABLED=""
ARG PUBLIC_SUPABASE_URL=""
ARG PUBLIC_SUPABASE_ANON_KEY=""
ARG PUBLIC_GODMODE_LOCAL_ENABLED="true"
# Optional Subresource Integrity (SRI) hashes for the third-party AdSense
# and GA scripts. Format: `sha384-<base64>`. Default empty = no integrity
# attribute set (current behavior). Operators who want SRI hardening fetch
# the live script body, run `cat script.js | openssl dgst -sha384 -binary | base64`,
# and pass it here. AdSense + GA rotate scripts often, so a stale hash
# silently breaks ads/analytics — refresh on a schedule when used.
ARG PUBLIC_ADSENSE_SRI=""
ARG PUBLIC_GA_SRI=""

# Expose them as environment variables so Vite's build step inlines them
# into the static output. (PUBLIC_* and VITE_* are read at BUILD time by
# SvelteKit / Vite — runtime container env has no effect on the served
# bundle, so they MUST be passed as build args, not just runtime env.)
ENV BASE_PATH=${BASE_PATH} \
    PUBLIC_ADSENSE_CLIENT=${PUBLIC_ADSENSE_CLIENT} \
    PUBLIC_GA_ID=${PUBLIC_GA_ID} \
    PUBLIC_ADSENSE_SRI=${PUBLIC_ADSENSE_SRI} \
    PUBLIC_GA_SRI=${PUBLIC_GA_SRI} \
    VITE_AUTH_ENABLED=${VITE_AUTH_ENABLED} \
    PUBLIC_SUPABASE_URL=${PUBLIC_SUPABASE_URL} \
    PUBLIC_SUPABASE_ANON_KEY=${PUBLIC_SUPABASE_ANON_KEY} \
    PUBLIC_GODMODE_LOCAL_ENABLED=${PUBLIC_GODMODE_LOCAL_ENABLED}

# Visible build-arg diagnostic — prints to the Dokploy build log so you can
# tell from the build output whether the env vars actually reached the build
# step. Values are masked (presence/length only) so the log is safe to share
# for support. If a value shows MISSING, the variable wasn't passed as a
# Docker build arg — see docs/DEPLOY-DOKPLOY-SUPABASE.md.
RUN sh -c '\
  status() { if [ -n "$1" ]; then echo "set, length=$(printf %s "$1" | wc -c | tr -d " ")"; else echo "MISSING"; fi; } ; \
  echo "[cryptex-build] BASE_PATH=$(status "$BASE_PATH")" ; \
  echo "[cryptex-build] VITE_AUTH_ENABLED=${VITE_AUTH_ENABLED:-MISSING}" ; \
  echo "[cryptex-build] PUBLIC_SUPABASE_URL=$(status "$PUBLIC_SUPABASE_URL")" ; \
  echo "[cryptex-build] PUBLIC_SUPABASE_ANON_KEY=$(status "$PUBLIC_SUPABASE_ANON_KEY")" ; \
  echo "[cryptex-build] PUBLIC_GODMODE_LOCAL_ENABLED=${PUBLIC_GODMODE_LOCAL_ENABLED:-MISSING}" ; \
  echo "[cryptex-build] PUBLIC_ADSENSE_CLIENT=${PUBLIC_ADSENSE_CLIENT:-MISSING}" ; \
  echo "[cryptex-build] PUBLIC_GA_ID=${PUBLIC_GA_ID:-MISSING}" ; \
  echo "[cryptex-build] PUBLIC_ADSENSE_SRI=$(status "$PUBLIC_ADSENSE_SRI")" ; \
  echo "[cryptex-build] PUBLIC_GA_SRI=$(status "$PUBLIC_GA_SRI")" ; \
'

# The SvelteKit build reads transformers from ../src/transformers via a Vite
# alias, so we bring both trees into the build context.
COPY src/transformers ./src/transformers
COPY app/package*.json ./app/

# Install only production + dev deps needed for the build.
RUN cd app && npm ci --no-audit --no-fund --prefer-offline

COPY app ./app
COPY scripts ./scripts
COPY nginx.conf ./nginx.conf

# Produce the static output at /build/app/build/. The build script also runs
# scripts/compute-csp-hashes.cjs as a post-step (see app/package.json), which
# walks `app/build/` and writes `app/build/csp-script-hashes.txt`. We then
# substitute that into `nginx.conf`'s `__CSP_SCRIPT_HASHES__` placeholder so
# the stage-2 image ships a CSP without `'unsafe-inline'`.
RUN cd app && npm run build

# Substitute computed sha256-base64 inline-script hashes into nginx.conf.
# Fail fast if the placeholder isn't found (template drift) or the hash
# file is empty (build-pipeline regression). Either case means the CSP
# would degrade to malformed and silently disable script-src checking.
RUN set -e ; \
    HASH_FILE=/build/app/build/csp-script-hashes.txt ; \
    [ -s "$HASH_FILE" ] || { echo "[cryptex-build] FATAL: $HASH_FILE missing or empty" >&2 ; exit 1 ; } ; \
    grep -q __CSP_SCRIPT_HASHES__ /build/nginx.conf || { echo "[cryptex-build] FATAL: nginx.conf is missing __CSP_SCRIPT_HASHES__ placeholder" >&2 ; exit 1 ; } ; \
    HASHES="$(tr -d '\n\r' < $HASH_FILE)" ; \
    awk -v hashes="$HASHES" '{ gsub(/__CSP_SCRIPT_HASHES__/, hashes); print }' /build/nginx.conf > /build/nginx.conf.new ; \
    mv /build/nginx.conf.new /build/nginx.conf ; \
    SHA_COUNT="$(grep -oE "'sha256-[A-Za-z0-9+/=]+'" /build/nginx.conf | sort -u | wc -l)" ; \
    if [ "$SHA_COUNT" -lt 1 ]; then echo "[cryptex-build] FATAL: substituted nginx.conf has no sha256 hashes" >&2 ; exit 1 ; fi ; \
    echo "[cryptex-build] CSP hashes substituted: $SHA_COUNT unique sha256 token(s) in nginx.conf" ; \
    rm "$HASH_FILE"

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
# nginx.conf comes from the builder stage where `__CSP_SCRIPT_HASHES__`
# was substituted with build-time-computed sha256-base64 hashes. Pulling
# from the local repo here would re-introduce the placeholder.
COPY --from=builder /build/nginx.conf /etc/nginx/nginx.conf

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
