# The "machine without internet" of the offline install test: Ubuntu 24.04 with Docker Engine
# and the Compose plugin from Ubuntu's own archive, as an air-gapped host would have them from
# a package mirror. It runs privileged with --network none and its own Docker inside.
FROM ubuntu:24.04@sha256:534baea6a22c03a63003dbc8dbe78fe34bc0d7e595d9a9dc9834884ff530eb55
RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install --yes --no-install-recommends \
      ca-certificates curl docker.io docker-compose-v2 e2fsprogs iproute2 \
 && rm -rf /var/lib/apt/lists/*
COPY --chmod=0755 offline-host.sh /usr/local/bin/offline-host
ENTRYPOINT ["/usr/local/bin/offline-host"]
