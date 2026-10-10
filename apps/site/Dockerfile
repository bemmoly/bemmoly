# The marketing site, built from the repository root:
#   docker build -f apps/site/Dockerfile -t bemmoly-site .
# Coolify: build pack Dockerfile, base directory /, Dockerfile location /apps/site/Dockerfile,
# port 80. apps/site/Dockerfile.dockerignore keeps node_modules and build output out of the
# context without a root .dockerignore, so other images keep their own rules.

FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    ASTRO_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

# The live demo at /demo: the web shell on its in-browser mock backend (apps/web build:demo).
# The shell bundles every module's web chunk from modules/*/web, so each module and its
# workspace dependencies are installed, as the application image does; a new module's
# screens reach the demo with no change here. Builds in parallel with the site.
FROM base AS demo
COPY . .
RUN pnpm install --frozen-lockfile --filter "@bemmoly/web..." --filter "@bemmoly/module-*..." \
 && pnpm --filter @bemmoly/web build:demo

FROM base AS build

# Manifests first so the dependency layer is cached until a lockfile or manifest changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .pnpmfile.cjs ./
COPY apps/site/package.json apps/site/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile --filter @bemmoly/site...

# Only what the build reads: the design system's tokens, styles and brand files, the site,
# the security policy the /security page renders, and the release notes /changelog is built
# from (tests/changelog.test.ts fails when a package's CHANGELOG.md is missing here).
COPY packages/ui/src packages/ui/src
COPY packages/ui/assets packages/ui/assets
COPY apps/site apps/site
COPY SECURITY.md ./
COPY apps/server/CHANGELOG.md apps/server/
COPY apps/web/CHANGELOG.md apps/web/
COPY packages/api-client/CHANGELOG.md packages/api-client/
COPY packages/core/CHANGELOG.md packages/core/
COPY packages/core-web/CHANGELOG.md packages/core-web/
COPY packages/editor/CHANGELOG.md packages/editor/
COPY packages/shared/CHANGELOG.md packages/shared/
COPY packages/ui/CHANGELOG.md packages/ui/
COPY modules/sample/CHANGELOG.md modules/sample/
COPY modules/work/CHANGELOG.md modules/work/
COPY deploy/CHANGELOG.md deploy/
COPY deploy/updater/CHANGELOG.md deploy/updater/
# Search Console and Bing Webmaster Tools tokens, only for the HTML-tag verification method;
# empty by default (README.md, Search engines). Set them as build variables in Coolify.
ARG SITE_GOOGLE_VERIFICATION=""
ARG SITE_BING_VERIFICATION=""
# scripts/bundle-demo.ts copies it into dist/demo after the Astro build.
COPY --from=demo /repo/apps/web/dist-demo apps/web/dist-demo
RUN pnpm --filter @bemmoly/site build

FROM caddy:2.11-alpine
COPY apps/site/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/apps/site/dist /srv
RUN caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
    CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
