# syntax=docker/dockerfile:1.7
# The runner image: Node 24, git for check outs, and the docker CLI for image builds. Steps run
# as sibling containers on the daemon whose socket is mounted in.
#
#   docker build -f apps/runner/Dockerfile -t ghcr.io/bemmoly/runner:dev .
#
# The daemon bind-mounts each job's workspace by its path on the host, so mount the data folder
# at the same path inside and out:
#   docker run -v /var/run/docker.sock:/var/run/docker.sock \
#     -v /srv/bemmoly-runner:/srv/bemmoly-runner ghcr.io/bemmoly/runner:dev \
#     --url https://bemmoly.example.com --pool-token <token> --data-dir /srv/bemmoly-runner

ARG NODE_IMAGE=node:24-slim

FROM ${NODE_IMAGE} AS build
ENV CI=true PNPM_STORE=/pnpm/store
RUN npm install --global --no-fund --no-audit pnpm@11.7.0 && npm cache clean --force
WORKDIR /src
COPY pnpm-lock.yaml pnpm-workspace.yaml .pnpmfile.cjs package.json ./
COPY packages/shared ./packages/shared
COPY modules/pipelines/package.json ./modules/pipelines/package.json
COPY modules/pipelines/shared ./modules/pipelines/shared
COPY apps/runner ./apps/runner
# The runner reads only the Pipelines contracts (modules/pipelines/shared), which need zod and
# the shared package. The module's manifest is cut down to those two, and the root's dev tools
# dropped, before installing, so the image carries neither the server-side module nor the kernel
# behind it; versions still come from the lockfile.
RUN node -e "\
const fs = require('fs'); \
const edit = (f, change) => { const p = JSON.parse(fs.readFileSync(f, 'utf8')); change(p); fs.writeFileSync(f, JSON.stringify(p, null, 2)); }; \
edit('package.json', (p) => { delete p.devDependencies; }); \
edit('modules/pipelines/package.json', (p) => { \
  p.dependencies = { '@bemmoly/shared': 'workspace:*', zod: p.dependencies.zod }; \
  delete p.devDependencies; \
});"
RUN --mount=type=cache,id=bemmoly-pnpm,target=/pnpm/store \
    pnpm install --no-frozen-lockfile --prod --store-dir "$PNPM_STORE" --filter "@bemmoly/runner..." \
 && find packages modules apps \( -name '*.test.ts' -o -name '*.test-support.ts' \) -delete \
 && rm -rf apps/runner/test apps/runner/Dockerfile apps/runner/Dockerfile.dockerignore

FROM ${NODE_IMAGE} AS docker-cli
ARG TARGETARCH
ARG DOCKER_VERSION=28.5.1
ARG DOCKER_SHA256_AMD64=5c0d19f31fece1accd0358bb8cff591fe25d7b6cba19f0fd412cbfdc07f75ff6
ARG DOCKER_SHA256_ARM64=de54e37157f45a43f42f6271302372d95c0eb992cc35ecaee74989bb14058c94
RUN apt-get update \
 && apt-get install --yes --no-install-recommends ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*
RUN set -eu; \
    case "${TARGETARCH:-amd64}" in \
      amd64) arch=x86_64; sum="$DOCKER_SHA256_AMD64" ;; \
      arm64) arch=aarch64; sum="$DOCKER_SHA256_ARM64" ;; \
      *) echo "No docker CLI for ${TARGETARCH}" >&2; exit 1 ;; \
    esac; \
    curl -fsSLo /tmp/docker.tgz "https://download.docker.com/linux/static/stable/${arch}/docker-${DOCKER_VERSION}.tgz"; \
    echo "${sum}  /tmp/docker.tgz" | sha256sum -c -; \
    tar -xzf /tmp/docker.tgz -C /tmp docker/docker; \
    install -m 0755 /tmp/docker/docker /usr/local/bin/docker

FROM ${NODE_IMAGE} AS runtime
RUN apt-get update \
 && apt-get install --yes --no-install-recommends ca-certificates git tini \
 && rm -rf /var/lib/apt/lists/*
COPY --from=docker-cli /usr/local/bin/docker /usr/local/bin/docker
ARG BEMMOLY_VERSION=0.0.0-dev
ARG REVISION=unknown
LABEL org.opencontainers.image.title="Bemmoly runner" \
      org.opencontainers.image.description="Runs Bemmoly Pipelines jobs" \
      org.opencontainers.image.version="${BEMMOLY_VERSION}" \
      org.opencontainers.image.revision="${REVISION}" \
      org.opencontainers.image.source="https://github.com/bemmoly/bemmoly" \
      org.opencontainers.image.licenses="MIT"
WORKDIR /app
COPY --from=build --chown=node:node /src/node_modules ./node_modules
COPY --from=build --chown=node:node /src/packages/shared ./packages/shared
COPY --from=build --chown=node:node /src/modules/pipelines ./modules/pipelines
COPY --from=build --chown=node:node /src/apps/runner ./apps/runner
# The node user owns its home, where the registration and job folders live by default. Reaching
# the Docker socket needs its group: run with --group-add <the socket's gid>.
USER node
ENTRYPOINT ["tini", "--", "node", "apps/runner/src/main.ts"]
