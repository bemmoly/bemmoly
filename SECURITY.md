# Security policy

## Reporting a vulnerability

Report security issues privately, by either:

- GitHub's private vulnerability reporting: **Security › Report a vulnerability** on the
  repository, or
- email to **security@bemmoly.example**.

> **Placeholder.** `security@bemmoly.example` is not a working address yet; until it is
> replaced, use GitHub's private reporting. See "For maintainers" below.

Do not open a public issue, discussion or pull request for a security bug.

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

## Verifying a release

Every release image is signed with cosign (keyless, from the release workflow) and carries an
SPDX SBOM attestation. The release notes include the exact `cosign verify` command; the
in-app updater refuses images whose signature does not verify.

## What CI checks on every change

Dependency audit (`pnpm audit`, failing on high), secret scanning (gitleaks), Semgrep rules for
SQL built from strings and raw HTTP calls, and an image scan (Trivy) block merges. Dependabot
proposes dependency updates weekly. Details are in `.github/CI.md`.

## For maintainers: setting the reporting address

Before the first public release:

1. Replace `security@bemmoly.example` above with a mailbox at least two maintainers read
   (a group alias, not a personal address). Search the repository for `bemmoly.example` to find
   every placeholder; CODE_OF_CONDUCT.md has its own.
2. Turn on private vulnerability reporting in the repository settings
   (Settings › Code security › Private vulnerability reporting).
3. Remove the placeholder notice in the same change.
