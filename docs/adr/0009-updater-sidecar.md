# ADR 0009: In-app updates go through a small updater sidecar

- Status: accepted
- Date: 2026-10-07
- Tech design: [§18 Deploy](../tech-design.html#deploy) (Updating from inside the app), [§25 Open decisions](../tech-design.html#decisions)

## Context

The product shows an Update button, and it has to update the server for real. A container
cannot replace its own image. Something on the host must pull the new image, back up, swap
containers and roll back on a failed health check. Holding the Docker socket to do that is
root-equivalent on the host.

## Decision

1. The installer adds an `updater` container next to the app. It holds the Docker socket and
   does a fixed set of things: `update(tag)`, `rollback()` and `status()`.
2. It accepts requests only from the app, over the internal Compose network, with a token the
   installer generates. It has no published port.
3. It only runs tags from the official registry whose cosign signature verifies.
4. Each update follows the same steps as `bemmoly upgrade`: backup, pull and verify, swap,
   migrate, health check, and automatic rollback to the previous tag and backup on failure.
5. `install.sh --no-in-app-updates` leaves the updater out; the button then shows the CLI
   command instead. On Kubernetes the page shows the `helm upgrade` command.

## Consequences

- Updates work from the browser for the admins who never SSH into the host.
- The release pipeline must sign every image and publish the manifest the update check reads,
  which the release workflow does.
- The updater is deliberately dumb and small, so it can be reviewed; it is the one component
  with host-level power and gets the strictest review.
- Security teams that refuse a socket-holding container have a supported opt-out.

## Alternatives considered

- **No sidecar; updates by CLI only.** Simpler and safer, but the button can only show
  instructions. Kept as the opt-out.
- **The app holds the socket itself.** Gives root-equivalent power to the process that parses
  every request.
