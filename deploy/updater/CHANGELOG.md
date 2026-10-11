# @bemmoly/updater

## 0.12.0

### Minor Changes

- b769aed: The host `bemmoly` command now follows the release it manages. Until now only the installer
  wrote it, so an install that was upgraded kept the command it started with, and newer commands
  such as `sudo bemmoly sync-updater` answered "Unknown command".

  - `sudo bemmoly upgrade` moves the command to the new release once the app runs it, from the
    release's new `bemmoly-cli-X.Y.Z.tar.gz`, after cosign verifies the signed
    `release-manifest.json` and the tarball matches the checksum listed there. A command that
    cannot be verified is refused and never fails the upgrade.
  - In-app updates: the updater leaves its release's command in `/var/bemmoly/cli-update`, and the
    next `sudo bemmoly …` installs it before running.
  - `sudo bemmoly self-update [version]` refreshes the command on demand; `--from FOLDER` uses an
    extracted air-gap bundle, which now carries the command and the signed manifest.
    `sudo bemmoly version` prints the command's, the app's and the updater's versions.
  - `install.sh --refresh-cli` replaces only the command and leaves the app, its images and
    `.env` untouched. An install whose command is older than this runs it once:
    `curl -fsSL https://get.bemmoly.com | sh -s -- --refresh-cli`.

  No schema change. No new required configuration; `COSIGN_PUBLIC_KEY` and `BEMMOLY_RELEASES_URL`
  in `.env` are optional, for forks that sign with a key and for release mirrors. The release
  manifest gains an optional `cli` field (ADR 0024).

### Patch Changes

- Updated dependencies [b769aed]
- Updated dependencies [403ef1d]
- Updated dependencies [ea2125f]
  - @bemmoly/shared@0.12.0

## 0.11.0

### Patch Changes

- Updated dependencies [50fff66]
  - @bemmoly/shared@0.11.0

## 0.10.0

### Patch Changes

- Updated dependencies [e6982a1]
  - @bemmoly/shared@0.10.0

## 0.9.0

### Patch Changes

- Updated dependencies [250098f]
  - @bemmoly/shared@0.9.0

## 0.8.0

### Patch Changes

- Updated dependencies [31f9a87]
  - @bemmoly/shared@0.8.0

## 0.7.0

### Patch Changes

- Updated dependencies [8559222]
- Updated dependencies [65c412a]
  - @bemmoly/shared@0.7.0

## 0.6.0

### Minor Changes

- c4215a9: The updater now moves itself to the release it installs, verified with cosign like the app image, so updater fixes reach existing installs (ADR 0020). `bemmoly upgrade` does the same, and `bemmoly sync-updater` moves an older updater once. Clicking Update opens a dialog with each step's live status; every admin sees a running update, a second one is refused, and the page reloads onto the new version when it is ready.

### Patch Changes

- Updated dependencies [4e0e170]
- Updated dependencies [4cbf7a1]
- Updated dependencies [c4215a9]
  - @bemmoly/shared@0.6.0

## 0.5.0

### Patch Changes

- Updated dependencies [0a04d0d]
- Updated dependencies [fc28637]
- Updated dependencies [9911c5f]
  - @bemmoly/shared@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies [8f4df5f]
  - @bemmoly/shared@0.4.0

## 0.3.0

### Patch Changes

- @bemmoly/shared@0.3.0

## 0.2.2

### Patch Changes

- @bemmoly/shared@0.2.2

## 0.2.1

### Patch Changes

- @bemmoly/shared@0.2.1

## 0.2.0

### Patch Changes

- Updated dependencies [51cd3ae]
- Updated dependencies [e2aa5d2]
  - @bemmoly/shared@0.2.0

## 0.1.7

### Patch Changes

- 1830ed0: Fix in-app updates failing at the verify step with "mkdir /root/.sigstore: read-only file system". The updater runs on a read-only filesystem, and the signature check could not cache Sigstore's trust root. It now caches it in /tmp. Installs on 0.1.6 or older update once with `sudo bemmoly upgrade` to get the fixed updater; from then on, Update in Settings › Updates works.
- @bemmoly/shared@0.1.7

## 0.1.6

### Patch Changes

- @bemmoly/shared@0.1.6

## 0.1.5

### Patch Changes

- @bemmoly/shared@0.1.5

## 0.1.4

### Patch Changes

- @bemmoly/shared@0.1.4

## 0.1.3

### Patch Changes

- @bemmoly/shared@0.1.3

## 0.1.2

### Patch Changes

- Updated dependencies [8337385]
- Updated dependencies [8337385]
  - @bemmoly/shared@0.1.2

## 0.1.1

### Patch Changes

- @bemmoly/shared@0.1.1

## 0.1.0

### Patch Changes

- Updated dependencies [b403d58]
  - @bemmoly/shared@0.1.0
