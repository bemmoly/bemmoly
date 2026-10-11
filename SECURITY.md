# Security policy

## Reporting a vulnerability

Report security issues privately through GitHub's private vulnerability reporting:
**[Report a vulnerability](https://github.com/bemmoly/bemmoly/security/advisories/new)**
(the repository's **Security** tab › **Report a vulnerability**). Only the maintainers see the
report, and the fix and the advisory are prepared with you in the same private thread.

Do not open a public issue, discussion or pull request for a security bug. If you cannot use
GitHub's private reporting, open an issue that asks the maintainers for a private contact and
says nothing about the problem itself.

Include what you found, the version or commit, steps to reproduce, and the impact you expect.
If you can, propose a fix or a mitigation. If an error message showed a reference (a request
id), include it.

## What happens next

- We acknowledge your report within three working days.
- We confirm the issue, agree a severity with you, and keep you informed while we work on a fix.
- Fixes ship as patch releases on the current minor version, as described in `AGENTS.md`.
- We publish an advisory when the fix is available and credit you unless you ask us not to.

## Disclosure

We follow a 90-day coordinated disclosure policy. Please give us 90 days from your report before
any public disclosure, or less if a fix has already shipped. If an issue is being actively
exploited, we will work with you on a shorter timeline.

## Supported versions

Before 1.0, only the latest minor release receives security fixes.

## Scope

In scope: the application image and the updater image, the installer
(`get.bemmoly.com`, `deploy/install.sh`), the `bemmoly` CLI, the Compose files and the Helm
chart in `deploy/`, and the website at `bemmoly.com`. The live demo at `bemmoly.com/demo` runs
entirely in your browser on sample data with no server behind it, so a finding there matters
when it also applies to an installed workspace; say whether you checked.

## Verifying a release

Every release image is signed with cosign (keyless, from the release workflow) and carries an
SPDX SBOM attestation. The release notes include the exact `cosign verify` command; the
in-app updater refuses images whose signature does not verify.

## What CI checks on every change

Dependency audit (`pnpm audit`, failing on high), secret scanning (gitleaks), Semgrep rules for
SQL built from strings and raw HTTP calls, and an image scan (Trivy) block merges. Dependabot
proposes dependency updates weekly. Details are in `.github/CI.md`.
