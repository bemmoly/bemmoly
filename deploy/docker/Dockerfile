# syntax=docker/dockerfile:1.7
# The Bemmoly application image: one Node 24 process (api, worker or both) plus the
# Postgres 18 client tools that backups need. Build from the repository root:
#
#   docker build -f deploy/docker/Dockerfile -t ghcr.io/bemmoly/bemmoly:dev .
#
# No secret is ever copied in: Dockerfile.dockerignore keeps .env files, local data
# and dependencies out of the build context.

ARG NODE_IMAGE=node:24-trixie-slim

# pnpm and every package in the lockfile, fetched once into this stage's own layer. The
# store is not a cache mount: a layer restored from a registry or CI cache (type=gha)
# skips this step, and a cache mount is never exported with it, so the offline installs
# below found an empty store (ERR_PNPM_NO_OFFLINE_TARBALL). In the layer, the store is
# cached exactly when the step is, keyed on the lockfile. No stage after this writes to
# a shared store, so the web and server stages can also build in parallel safely.
FROM ${NODE_IMAGE} AS pnpm
ENV CI=true PNPM_STORE=/pnpm/store
RUN npm install --global --no-fund --no-audit pnpm@11.7.0 && npm cache clean --force
WORKDIR /src
COPY pnpm-lock.yaml pnpm-workspace.yaml .pnpmfile.cjs package.json ./
RUN pnpm fetch --store-dir "$PNPM_STORE"

# The web shell, built with its dev dependencies.
FROM pnpm AS web
COPY . .
RUN pnpm install --offline --frozen-lockfile --store-dir "$PNPM_STORE" --filter "@bemmoly/web..." \
 && pnpm --filter @bemmoly/web build

# The server and the packages it loads, production dependencies only. Internal packages
# run from their TypeScript sources; workspace links keep them outside node_modules,
# which is where Node strips types. `pnpm fetch` left every package in node_modules, so
# the production install starts from an empty one.
FROM pnpm AS server
COPY apps/server ./apps/server
COPY packages/core ./packages/core
COPY packages/shared ./packages/shared
# The email templates read the theme tokens from the design system at runtime.
COPY packages/ui ./packages/ui
COPY modules ./modules
RUN rm -rf node_modules \
 && pnpm install --offline --frozen-lockfile --prod --store-dir "$PNPM_STORE" --filter "@bemmoly/server..." \
 && find apps packages modules -name '*.test.ts' -delete \
 && rm -rf packages/core/src/testing \
 && mkdir -p node_modules/@bemmoly \
 && ln -s ../../packages/core node_modules/@bemmoly/core

FROM ${NODE_IMAGE} AS runtime
# Empty unless the release names the version; the server then reports its package version.
ARG BEMMOLY_VERSION=
ARG REVISION=unknown
ARG CREATED=unknown
LABEL org.opencontainers.image.title="Bemmoly" \
      org.opencontainers.image.description="Your work. Your platform. Self-hosted issues and docs." \
      org.opencontainers.image.version="${BEMMOLY_VERSION:-unreleased}" \
      org.opencontainers.image.revision="${REVISION}" \
      org.opencontainers.image.created="${CREATED}" \
      org.opencontainers.image.source="https://github.com/bemmoly/bemmoly" \
      org.opencontainers.image.url="https://bemmoly.com" \
      org.opencontainers.image.documentation="https://bemmoly.com/docs/install" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.vendor="Bemmoly contributors"

# Postgres 18 client tools from the PostgreSQL project's repository, so backups work
# against the bundled database and any external one.
RUN apt-get update \
 && apt-get install --yes --no-install-recommends ca-certificates curl gnupg tini \
 && install -d /usr/share/postgresql-common/pgdg \
 && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
      | gpg --dearmor -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg \
 && . /etc/os-release \
 && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg] https://apt.postgresql.org/pub/repos/apt ${VERSION_CODENAME}-pgdg main" \
      > /etc/apt/sources.list.d/pgdg.list \
 && apt-get update \
 && apt-get install --yes --no-install-recommends postgresql-client-18 \
 && apt-get purge --yes --auto-remove curl gnupg \
 && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 10001 bemmoly \
 && useradd --system --uid 10001 --gid bemmoly --home-dir /app --shell /usr/sbin/nologin bemmoly \
 && install -d -o bemmoly -g bemmoly /var/bemmoly/data /var/bemmoly/backups

WORKDIR /app
COPY --from=server /src/node_modules ./node_modules
COPY --from=server /src/apps/server ./apps/server
COPY --from=server /src/packages ./packages
COPY --from=server /src/modules ./modules
COPY --from=web /src/apps/web/dist ./apps/web/dist
COPY deploy/docker/bin/ /usr/local/bin/

ENV BEMMOLY_VERSION=${BEMMOLY_VERSION} \
    BEMMOLY_PG_BIN_DIR=/usr/lib/postgresql/18/bin \
    BEMMOLY_DATA_DIR=/var/bemmoly/data \
    BEMMOLY_BACKUP_DIR=/var/bemmoly/backups \
    PORT=8080

USER bemmoly
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=5s --start-period=90s --retries=6 CMD ["bemmoly-health"]
# The entrypoint prepares the database, then runs this command. The preload starts
# OpenTelemetry only when OTEL_EXPORTER_OTLP_ENDPOINT is set.
ENTRYPOINT ["tini", "--", "bemmoly-entrypoint"]
CMD ["node", "--import", "@bemmoly/core/telemetry/preload", "apps/server/src/server.ts"]
