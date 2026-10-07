# The marketing site, built from the repository root:
#   docker build -f apps/site/Dockerfile -t bemmoly-site .
# Coolify: build pack Dockerfile, base directory /, Dockerfile location /apps/site/Dockerfile,
# port 80. apps/site/Dockerfile.dockerignore keeps node_modules and build output out of the
# context without a root .dockerignore, so other images keep their own rules.

FROM node:24-slim AS build
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    ASTRO_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

# Manifests first so the dependency layer is cached until a lockfile or manifest changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .pnpmfile.cjs ./
COPY apps/site/package.json apps/site/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile --filter @bemmoly/site...

# Only what the build reads: the design system's tokens, styles and brand files, the site,
# and the security policy the /security page renders.
COPY packages/ui/src packages/ui/src
COPY packages/ui/assets packages/ui/assets
COPY apps/site apps/site
COPY SECURITY.md ./
RUN pnpm --filter @bemmoly/site build

FROM caddy:2.11-alpine
COPY apps/site/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/apps/site/dist /srv
RUN caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
    CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
