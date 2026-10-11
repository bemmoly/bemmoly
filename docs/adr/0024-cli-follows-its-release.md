# ADR 0024: The bemmoly command follows the release it manages

- Status: accepted
- Date: 2026-10-11
- Builds on: [ADR 0020](0020-updater-updates-itself.md), [ADR 0009](0009-updater-sidecar.md)
- Tech design: [§18 Deploy](../tech-design.html#deploy) (The `bemmoly` CLI, Updating from inside the app)

## Context

The host command (`/usr/local/bin/bemmoly` and `/usr/local/lib/bemmoly/*.sh`) was written only by
the installer. `bemmoly upgrade` and in-app updates moved the app and the updater containers, never
the command. An install that started on an old release and was upgraded kept its first command:
on 0.7.0 and later, `sudo bemmoly sync-updater` answered "Unknown command". The updater cannot fix
this from inside: it is a container, the host's `/usr/local/bin` is not mounted, and mounting it
would hand a socket-holding container one more way onto the host.

## Decision

1. **A release ships its command.** `deploy/scripts/release-cli.sh` builds
   `bemmoly-cli-X.Y.Z.tar.gz` (`bemmoly-cli/` with `bemmoly`, `lib/*.sh`, `completion.bash` and
   `VERSION`, laid out as installed). The release attaches it, and `release-manifest.json` lists
   its name and SHA-256 under `cli`. The manifest is already signed keyless by the release
   workflow, so one cosign check covers the command too. Installed commands carry
   `/usr/local/lib/bemmoly/VERSION`.
2. **`bemmoly upgrade` moves the command after the app.** Once the app runs the new version, the
   command downloads the manifest and its `.sigstore.json` bundle, verifies them with cosign
   (the host's, else the one in the installed updater image) against the release workflow's
   identity, or `COSIGN_PUBLIC_KEY` when set, checks the tarball's SHA-256 against the manifest,
   checks every file parses, installs each file by rename (VERSION last) and runs
   `bemmoly version` with the new copy. An upgrade that rolled back never changes the
   command; a refused command never fails an upgrade that succeeded (as ADR 0020 §4).
3. **In-app updates: the updater stages, the command installs.** The updater image carries the
   same tarball, built from the same tree. On start, the updater copies it to
   `BEMMOLY_DIR/cli-update/` (tarball, checksum, VERSION). The image passed the cosign check
   before it ran (ADR 0020), so the copy is as trusted as the updater, which already holds the
   Docker socket. Before any command run as root, `bemmoly` installs the staged copy when it is
   for the release `.env` says the app runs and is newer than itself, then runs the command
   again with the new copy. It refuses a folder anyone but root can write (the app container
   mounts only `data/` and `backups/`) and a tarball that fails its checksum.
4. **`bemmoly self-update [version] [--from FOLDER]`** does step 2 on demand: to the app's
   release by default, to any release explicitly, or from an extracted air-gap bundle folder,
   which now carries the tarball and the signed manifest.
5. **Same signature rule as images.** An unverifiable manifest (no cosign, offline trust root, a
   bad signature) is refused unless `BEMMOLY_ALLOW_UNSIGNED_UPDATES=true`; the checksum is checked
   either way.
6. **Never backwards by itself.** Automatic moves (upgrade, staged copy) only go forward and only
   to the app's release. After an app rollback the command stays on its newer release, like the
   updater (ADR 0020 §5); `bemmoly self-update <version>` moves it anywhere.
7. **Bootstrap.** A command that predates this ADR cannot update itself. The installer gains
   `--refresh-cli`: it checks there is an install, replaces only the command with the installer's
   release, and touches no image, container or `.env`:

   ```sh
   curl -fsSL https://get.bemmoly.com | sh -s -- --refresh-cli
   ```

   From an air-gap bundle folder: `sudo sh install.sh --refresh-cli`.

## Consequences

- Every release has one more asset; the manifest schema gains an optional `cli` (older manifests
  still parse). The air-gap bundle carries the command and the signed manifest.
- The updater image carries the command (about 20 KB) and writes `BEMMOLY_DIR/cli-update/`.
- A newer command can manage an older app for a while (after `--refresh-cli` from the latest
  release, or after a rollback); `bemmoly version` says so.

## Alternatives considered

- **The updater writes `/usr/local/bin` through a helper container that mounts it.** It works,
  and it is exactly the host escape ADR 0009 keeps the updater away from.
- **A systemd path unit that installs the staged copy.** Not every host runs systemd, it is one
  more root unit to install and keep, and the command is the only consumer: installing on its next
  run is soon enough.
- **The command downloads from GitHub whenever it lags.** It would need the network on every run
  and does nothing for air-gapped installs; the staged copy needs neither.
