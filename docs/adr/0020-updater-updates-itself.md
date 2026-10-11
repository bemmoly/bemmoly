# ADR 0020: The updater moves itself to the release it installs

- Status: accepted
- Date: 2026-10-11
- Builds on: [ADR 0009](0009-updater-sidecar.md)
- Tech design: [§18 Deploy](../tech-design.html#deploy) (Updating from inside the app, Rolling back)

## Context

The updater container is pinned by `UPDATER_VERSION` in `.env`. In-app updates swapped only the
app container, so an install that started on an old updater kept it forever (app 0.5.0 still
ran the updater it was installed with) and updater fixes never reached existing installs. A
container cannot replace itself: stopping its own container kills the process mid-run.

## Decision

1. **A new last step, `updater`.** After the app is healthy and committed (maintenance already
   ended), the updater that ran the update pulls `UPDATER_IMAGE:<tag>` and verifies it with
   cosign, the same check and the same `BEMMOLY_ALLOW_UNSIGNED_UPDATES` rule as the app image.
2. **One-shot runs swap directly.** `bemmoly upgrade` runs the updater in a throwaway container,
   which is not the service: it swaps the `updater` service container (stop, keep as
   `-previous`, start the new image with the same env, mounts, network and labels), waits for
   `/healthz`, and removes the old one.
3. **The service hands off.** The long-running updater starts a short-lived helper container
   *from the verified new image* (`updater-cli adopt <tag> --from <old>`, auto-removed) and
   returns, leaving the state at `running / updater`. The old updater releases the operation
   lock and refuses new work (409). The helper waits for the lock, swaps the service container
   exactly as in 2, and writes the end state. A hand-off nobody finishes is closed by the old
   updater after 12 minutes, or by the next updater start.
4. **Never fails the app update.** If the image cannot be pulled, verified or started, the old
   updater container runs again, `.env` keeps the old `UPDATER_VERSION`, and the state records
   `selfUpdate.outcome = kept` with the reason. The app update stays succeeded.
5. **Rollback.** An app rollback leaves the updater on its newer release (it updates and rolls
   back older versions alike; its API is the same three calls). The previous updater version is
   kept in state (`updaterPrevious`) and its image is not pruned, so a manual rollback is
   `sudo bemmoly config set UPDATER_VERSION <old>` then `sudo bemmoly start`.
6. **Bootstrap.** An updater that predates this ADR cannot move itself. `bemmoly upgrade` and the
   new `bemmoly sync-updater` fall back to Compose pulling `updater:<VERSION>` from the official
   registry (the trust the installer already uses). Once an install runs an updater with this
   ADR, every later update moves it with a cosign check.
7. `BEMMOLY_UPDATER_SELF_UPDATE=false` keeps the updater on the pinned version.

## Consequences

- Updater fixes reach every install on its next update; Settings › Updates shows the step.
- The state file gains `target`, `startedAt`, `updaterVersion`, `updaterPrevious` and
  `selfUpdate` (all defaulted, so older files and older apps still parse), and the step `updater`.
- The helper container briefly holds the Docker socket, with the same restrictions as the service
  (read-only root, no published port, `no-new-privileges`).

## Alternatives considered

- **The app swaps the updater.** The app would need the Docker socket, which ADR 0009 rejects.
- **Updater exits and lets the restart policy start the new image.** Compose recreates on
  `compose up`, not on a restart; the container would come back on the old image.
