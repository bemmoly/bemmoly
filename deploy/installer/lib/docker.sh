# shellcheck shell=sh
# Docker Engine and the Compose plugin from Docker's official repositories, when absent.

DOCKER_REPO=https://download.docker.com/linux
COMPOSE_FALLBACK_VERSION=v5.5.1

docker_ready() {
  have docker && as_root docker compose version >/dev/null 2>&1
}

apt_install_docker() {
  repo_os="${OS_ID}"
  [ "${OS_FAMILY}" = ubuntu ] || repo_os=debian
  codename="${OS_CODENAME}"
  quietly as_root apt-get update || die "apt-get update failed" "Check the machine's package sources and network, then run the installer again."
  quietly as_root env DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl gnupg ||
    die "Could not install curl and gnupg" "Run: sudo apt-get install -y ca-certificates curl gnupg"
  # A release newer than Docker's repository uses the newest codename Docker publishes.
  if ! curl -fsSI "${DOCKER_REPO}/${repo_os}/dists/${codename}/Release" >/dev/null 2>&1; then
    fallback=noble
    [ "${repo_os}" = debian ] && fallback=bookworm
    printf '\n' >>"${BEMMOLY_LOG}"
    echo "Docker has no ${codename} repository yet; using ${fallback}" >>"${BEMMOLY_LOG}"
    codename="${fallback}"
  fi
  quietly as_root install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "${DOCKER_REPO}/${repo_os}/gpg" | as_root gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg ||
    die "Could not fetch Docker's signing key" "Check outbound HTTPS to download.docker.com."
  printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.gpg] %s/%s %s stable\n' \
    "$(dpkg --print-architecture)" "${DOCKER_REPO}" "${repo_os}" "${codename}" |
    as_root tee /etc/apt/sources.list.d/docker.list >/dev/null
  quietly as_root apt-get update || die "Docker's repository could not be read" "See the log, then run the installer again."
  quietly as_root env DEBIAN_FRONTEND=noninteractive apt-get install -y \
    docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin ||
    die "Installing Docker failed" "Install Docker Engine by hand (https://docs.docker.com/engine/install/), then run the installer again."
}

dnf_install_docker() {
  if dnf --version 2>/dev/null | grep -q '^dnf5'; then
    quietly as_root dnf config-manager addrepo --overwrite --from-repofile="${DOCKER_REPO}/fedora/docker-ce.repo"
  else
    quietly as_root dnf -y install dnf-plugins-core
    quietly as_root dnf config-manager --add-repo "${DOCKER_REPO}/fedora/docker-ce.repo"
  fi
  quietly as_root dnf -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin ||
    die "Installing Docker failed" "Install Docker Engine by hand (https://docs.docker.com/engine/install/fedora/), then run the installer again."
}

# Amazon Linux ships Docker Engine itself; the Compose plugin comes from Docker's releases.
amzn_install_docker() {
  quietly as_root dnf -y install docker || die "Installing Docker failed" "Run: sudo dnf install -y docker"
  if as_root docker compose version >/dev/null 2>&1; then return 0; fi
  arch=$(uname -m)
  base="https://github.com/docker/compose/releases/download/${COMPOSE_FALLBACK_VERSION}"
  file="docker-compose-linux-${arch}"
  tmp=$(mktemp -d)
  if ! curl -fsSL -o "${tmp}/${file}" "${base}/${file}" || ! curl -fsSL -o "${tmp}/${file}.sha256" "${base}/${file}.sha256"; then
    die "Could not download the Compose plugin" "Check outbound HTTPS to github.com."
  fi
  (cd "${tmp}" && sha256sum -c "${file}.sha256" >/dev/null) || die "The Compose plugin failed its checksum" "Run the installer again; if it repeats, report it."
  as_root install -D -m 0755 "${tmp}/${file}" /usr/local/lib/docker/cli-plugins/docker-compose
  rm -rf "${tmp}"
}

ensure_docker() {
  step "Installing Docker"
  if docker_ready; then
    as_root systemctl start docker >/dev/null 2>&1 || true
    step_done "already installed"
    return 0
  fi
  case "${OS_FAMILY}" in
    ubuntu | debian) apt_install_docker ;;
    fedora) dnf_install_docker ;;
    amzn) amzn_install_docker ;;
  esac
  quietly as_root systemctl enable --now docker || die "Docker did not start" "Run: sudo systemctl status docker"
  docker_ready || die "Docker is installed but docker compose does not work" "Run: docker compose version"
  step_done
}
