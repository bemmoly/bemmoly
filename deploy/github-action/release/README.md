# bemmoly/release

Keep GitHub Actions for build and test; let Bemmoly Pipelines take over from the built image.
Add one step at the end of your workflow and the image becomes a Pipelines release, ready to
promote through your environments under your policies.

```yaml
# .github/workflows/build.yml
permissions:
  contents: read
  id-token: write # lets the step sign with the workflow's own OIDC token: no stored secret

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      # … your checkout, tests and image push, unchanged …
      - uses: bemmoly/release@v1
        with:
          server: https://bemmoly.acme.dev
          application: checkout-api
          image: ${{ steps.push.outputs.digest }}
          image-repository: ghcr.io/acme/checkout-api
          tests: reports/**/*.xml
```

## Inputs

| Input              | Required    | What it is                                                                 |
| ------------------ | ----------- | -------------------------------------------------------------------------- |
| `server`           | yes         | Your Bemmoly address                                                       |
| `application`      | yes         | The application's key in the Pipelines catalog                             |
| `image`            | one of them | The digest you pushed, `sha256:…`                                          |
| `images`           | one of them | One `platform=sha256:…` per line, for multi-platform images                |
| `image-repository` | no          | Where the image lives                                                      |
| `version`          | no          | The release's version; the commit's short sha by default                   |
| `tests`            | no          | JUnit XML reports, a path or glob per line; shown on the release and gates |
| `notes`            | no          | Release notes                                                              |
| `token`            | no          | A scoped CI token, instead of OIDC                                         |

Outputs: `release-id` and `version`.

## How it signs in

By default the step asks GitHub for the workflow's OIDC token with your Bemmoly address as the
audience and sends it as `Authorization: Bearer <token>`. Pipelines checks it against GitHub's
issuer and a trust rule for the repository (Platform › Bring your CI): a workflow can register
releases only for applications in its own repository, from the refs the rule allows. A
`token` input skips OIDC and sends that token instead.

## The request

`POST {server}/api/v1/pipelines/releases`, JSON, the same body `bp release create` sends:

```json
{
  "application": "checkout-api",
  "version": "a1c9e3f",
  "commitSha": "a1c9e3f0…",
  "ref": "refs/heads/main",
  "imageRepository": "ghcr.io/acme/checkout-api",
  "image": "sha256:…",
  "tests": { "total": 412, "passed": 411, "failed": 1, "skipped": 0, "failures": [] },
  "externalUrl": "https://github.com/acme/checkout/actions/runs/42"
}
```

## Building and publishing

GitHub runs an action's main file without installing anything, so the action ships as one
bundled file, `dist/index.mjs`, committed beside `action.yml`. That makes it usable straight
from this repository before it is published on its own:

```yaml
- uses: bemmoly/bemmoly/deploy/github-action/release@main
```

After changing the action or `@bemmoly/pipelines-cli`, run
`pnpm --filter @bemmoly/release-action build` and commit `dist/`; the package's tests fail
while the committed bundle differs from a fresh build. Publishing copies `action.yml`,
`README.md` and `dist/` to the `bemmoly/release` repository and tags `v1`.
