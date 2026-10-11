#!/bin/sh
# Entry point of the offline test machine: starts its own Docker Engine and waits.
#
# OFFLINE_DISK=/disk.img puts Docker's data, /var/bemmoly and /var/tmp on an ext4 file
# (created on first use), for hosts whose container disk is too small for two releases.
set -eu

# cgroup v2: leave the root cgroup so the inner dockerd can delegate controllers, as the
# official docker:dind image does.
if [ -f /sys/fs/cgroup/cgroup.controllers ]; then
  mkdir -p /sys/fs/cgroup/init
  xargs -rn1 </sys/fs/cgroup/cgroup.procs >/sys/fs/cgroup/init/cgroup.procs 2>/dev/null || true
  sed -e 's/ / +/g' -e 's/^/+/' </sys/fs/cgroup/cgroup.controllers \
    >/sys/fs/cgroup/cgroup.subtree_control 2>/dev/null || true
fi

if [ -n "${OFFLINE_DISK:-}" ]; then
  [ -s "${OFFLINE_DISK}" ] || { truncate -s "${OFFLINE_DISK_SIZE:-24G}" "${OFFLINE_DISK}" && mkfs.ext4 -q "${OFFLINE_DISK}"; }
  mkdir -p /mnt/disk
  mount -o loop "${OFFLINE_DISK}" /mnt/disk
  for dir in /var/lib/docker /var/bemmoly /var/tmp; do
    mkdir -p "/mnt/disk${dir}" "${dir}"
    mount --bind "/mnt/disk${dir}" "${dir}"
  done
  chmod 1777 /var/tmp
fi

dockerd >/var/log/dockerd.log 2>&1 &
for _ in $(seq 1 60); do
  if docker info >/dev/null 2>&1; then break; fi
  sleep 1
done
docker info >/dev/null 2>&1 || { cat /var/log/dockerd.log >&2; exit 1; }
echo 'offline-host: docker is ready'
wait
