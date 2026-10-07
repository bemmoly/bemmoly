# syntax=docker/dockerfile:1.7
# The updater image: a small Node 24 service that holds the Docker socket and swaps the
# app container on request. cosign is included so signatures are verified by default.
#
#   docker build -f deploy/updater/Dockerfile -t ghcr.io/bemmoly/updater:dev .

ARG NODE_IMAGE=node:24-trixie-slim
ARG COSIGN_IMAGE=ghcr.io/sigstore/cosign/cosign:v3.1.3@sha256:9e5c2f2edc34351160407ca3416c61855bdf9403c3c5936e0f0be7fc261611b8

FROM ${COSIGN_IMAGE} AS cosign

FROM ${NODE_IMAGE} AS build
ENV CI=true PNPM_STORE=/pnpm/store
RUN npm install --global --no-fund --no-audit pnpm@11.7.0 && npm cache clean --force
WORKDIR /src
COPY pnpm-lock.yaml pnpm-workspace.yaml .pnpmfile.cjs package.json ./
COPY packages/shared ./packages/shared
COPY deploy/updater ./deploy/updater
RUN --mount=type=cache,id=bemmoly-pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --store-dir "$PNPM_STORE" --filter "@bemmoly/updater..." \
 && find packages deploy -name '*.test.ts' -delete \
 && rm -f deploy/updater/Dockerfile deploy/updater/Dockerfile.dockerignore

FROM ${NODE_IMAGE} AS runtime
ARG BEMMOLY_VERSION=0.0.0-dev
ARG REVISION=unknown
ARG CREATED=unknown
LABEL org.opencontainers.image.title="Bemmoly updater" \
      org.opencontainers.image.description="Updates and rolls back a Bemmoly install from inside the app" \
      org.opencontainers.image.version="${BEMMOLY_VERSION}" \
      org.opencontainers.image.revision="${REVISION}" \
      org.opencontainers.image.created="${CREATED}" \
      org.opencontainers.image.source="https://github.com/bemmoly/bemmoly" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.vendor="Bemmoly contributors"
RUN apt-get update \
 && apt-get install --yes --no-install-recommends ca-certificates tini \
 && rm -rf /var/lib/apt/lists/*
COPY --from=cosign /ko-app/cosign /usr/local/bin/cosign
WORKDIR /app
COPY --from=build /src/node_modules ./node_modules
COPY --from=build /src/packages/shared ./packages/shared
COPY --from=build /src/deploy/updater ./deploy/updater
COPY deploy/updater/bin/ /usr/local/bin/
# Root inside the container is needed for the Docker socket; the container publishes no
# port, mounts nothing but the socket and the install folder, and runs read-only.
EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD ["updater-health"]
ENTRYPOINT ["tini", "--"]
CMD ["node", "/app/deploy/updater/src/server.ts"]
