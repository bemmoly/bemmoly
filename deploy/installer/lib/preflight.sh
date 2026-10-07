# shellcheck shell=sh
# Preflight checks, shared by the installer and `bemmoly doctor`. Each failure names
# the fix. Sets OS_ID, OS_FAMILY, OS_NAME, OS_CODENAME, CPU_COUNT, MEM_MB.

MIN_MEM_MB=1800
MIN_DISK_GB=10

detect_os() {
  [ -r /etc/os-release ] || die "Cannot tell which Linux this is (/etc/os-release is missing)" \
    "Bemmoly's installer supports Ubuntu, Debian, Fedora and Amazon Linux; elsewhere use Docker Compose by hand: https://bemmoly.dev/docs/compose"
  # shellcheck disable=SC1091
  OS_ID=$(. /etc/os-release && printf '%s' "${ID:-}")
  OS_LIKE=$(. /etc/os-release && printf '%s' "${ID_LIKE:-}")
  OS_NAME=$(. /etc/os-release && printf '%s %s' "${NAME:-Linux}" "${VERSION_ID:-}")
  OS_CODENAME=$(. /etc/os-release && printf '%s' "${VERSION_CODENAME:-${UBUNTU_CODENAME:-}}")
  case "${OS_ID}" in
    ubuntu | debian | fedora | amzn) OS_FAMILY="${OS_ID}" ;;
    *)
      case " ${OS_LIKE} " in
        *" ubuntu "* | *" debian "*) OS_FAMILY=debian ;;
        *" fedora "*) OS_FAMILY=fedora ;;
        *) die "${OS_NAME} is not supported by the installer" \
          "Use Ubuntu 22.04+, Debian 12+, Fedora 40+ or Amazon Linux 2023, or run Docker Compose by hand: https://bemmoly.dev/docs/compose" ;;
      esac
      ;;
  esac
  OS_NAME=$(printf '%s' "${OS_NAME}" | sed 's/ GNU\/Linux//; s/ LTS//')
}

detect_resources() {
  CPU_COUNT=$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 1)
  MEM_MB=$(awk '/^MemTotal:/ { printf "%d", $2 / 1024 }' /proc/meminfo)
}

describe_machine() {
  printf '%s, %s vCPU, %s GB' "${OS_NAME}" "${CPU_COUNT}" "$(((MEM_MB + 512) / 1024))"
}

check_privileges() {
  if [ "$(id -u)" -eq 0 ]; then return 0; fi
  have sudo || die "The installer needs root" "Run it as root, or install sudo: curl -fsSL https://get.bemmoly.dev | sudo sh"
  sudo -v 2>/dev/null ||
    die "sudo did not grant root" "Run it as root: curl -fsSL https://get.bemmoly.dev | sudo sh"
}

check_memory() {
  [ "${MEM_MB}" -ge "${MIN_MEM_MB}" ] || die "This machine has ${MEM_MB} MB of memory; Bemmoly needs 2 GB" \
    "Resize the VM to at least 2 GB (4 GB is comfortable for 200 people)."
}

# Free GB on the filesystem that will hold `dir` (its nearest existing parent).
free_gb() {
  dir="$1"
  while [ ! -d "${dir}" ]; do dir=$(dirname "${dir}"); done
  df -Pk "${dir}" | awk 'NR == 2 { printf "%d", $4 / 1048576 }'
}

check_disk() {
  free=$(free_gb "$1")
  [ "${free}" -ge "${MIN_DISK_GB}" ] || die "Only ${free} GB free for $1; Bemmoly needs 10 GB" \
    "Grow the disk or pick another folder with --dir (backups live there too)."
}

port_in_use() {
  if have ss; then
    ss -Hltn "sport = :$1" 2>/dev/null | grep -q .
  elif have netstat; then
    netstat -ltn 2>/dev/null | awk '{ print $4 }' | grep -Eq "[:.]$1\$"
  else
    return 1
  fi
}

# Ports 80 and 443, unless our own proxy already holds them (a re-run).
check_ports() {
  if have docker && as_root docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^bemmoly-proxy-'; then
    return 0
  fi
  for port in 80 443; do
    if port_in_use "${port}"; then
      die "Port ${port} is already in use on this machine" \
        "Stop the web server that holds it (sudo ss -ltnp 'sport = :${port}' shows which), or re-run with --no-proxy and put Bemmoly behind it."
    fi
  done
}

check_dns() {
  getent hosts ghcr.io >/dev/null 2>&1 || nslookup ghcr.io >/dev/null 2>&1 ||
    die "This machine cannot resolve ghcr.io" \
      "Check the DNS servers in /etc/resolv.conf and outbound access on port 53, or install from a release bundle with --image-archive."
}

# Everything before the first change to the machine.
run_preflight() {
  check_privileges
  detect_os
  detect_resources
  check_memory
  check_disk "$1"
  if [ -z "${NO_PROXY:-}" ]; then check_ports; fi
  if [ -z "${IMAGE_ARCHIVE:-}" ]; then check_dns; fi
}
