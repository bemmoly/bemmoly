# Run a monorepo with one repository file

A monorepo often builds many services from one shared Dockerfile, with a build arg that picks
the service. Pipelines can describe all of them in one file at the repository root,
`.bemmoly/repository.yaml`, instead of an `application.yaml` in every folder. This guide sets
one up for a repository like this:

```
docker/service.Dockerfile     one Dockerfile for every service, built with SERVICE=<name>
services/orders/              a service
services/invoices/            a service
services/shipping/            a service
apps/web/                     a web app with its own Dockerfile
packages/money/               a shared library, only checked
packages/…                    code every service uses
```

It assumes you have shipped one application already with
[Ship your own project](your-own-project.md): a code host connected, a runner, environments
and a group in the Catalog.

## 1. Let discovery propose the file

In Pipelines, open Set up, step 2, and scan the repository. Discovery finds folders that share
a Dockerfile in two ways:

- A Dockerfile with an `ARG` that picks a folder, such as `COPY services/${SERVICE} …`. Every
  folder under `services/` is proposed.
- A compose file whose services build one Dockerfile with different `args`.

**You should see** each service proposed with the signal **Shared Dockerfile**, and under the
list a section **One repository file for** your repository. It shows the file the pull
request will add: the shared Dockerfile and build args in `defaults`, and one short entry per
service. A folder with its own Dockerfile, like `apps/web`, still gets its own
`application.yaml`.

Choose a group and press **Accept**. **You should see** one pull request that adds
`.bemmoly/repository.yaml` and `apps/web/.bemmoly/application.yaml`. Merge it.

You can also write the file by hand. The rest of this guide explains what it holds.

## 2. The repository file

```yaml
defaults:
  group: orders
  owner: team/orders
  paths: ['packages/**']
  build:
    dockerfile: docker/service.Dockerfile
    args:
      SERVICE: '${{ app.name }}'
  pipeline:
    test:
      - name: Unit tests
        image: node:24
        run: npm test
applications:
  - name: orders
    path: services/orders
    tier: 1
  - name: invoices
    path: services/invoices
  - name: shipping
    path: services/shipping
  - name: money
    path: packages/money
    build: null
```

- **`defaults`** apply to every application in the repository: `build` (`dockerfile`,
  `context`, `args`, `platforms`, `pool`), `paths`, `pipeline` (steps, or `extends` a
  template), `labels`, `group`, `domain` and `owner`.
- **`applications`** is the central list. Each entry has a `name`, the `path` of its folder,
  and any field `application.yaml` takes. `build` in an entry is the pipeline's build, and
  `build: null` turns the shared build off.
- The list is optional. A repository can use only `defaults`, and keep an `application.yaml`
  in each folder.

Quote values that start with `${{`, as above, so YAML reads them as text.

### Which setting wins

A folder's own `.bemmoly/application.yaml` beats its entry in the central list, which beats
`defaults`. Lists add up: `paths`, `labels` and `dependsOn` from every level are combined.
Anything else is replaced by the stronger level. Objects merge key by key, so an entry can add
one build arg without repeating the Dockerfile. `null` removes what a weaker level set, such as
`SERVICE: null` for an app that builds its own Dockerfile:

```yaml
# apps/web/.bemmoly/application.yaml
name: web
pipeline:
  build:
    dockerfile: apps/web/Dockerfile
    context: apps/web
    args:
      SERVICE: null
```

**You should see** on each application's page a **Settings** card. It names the file that
defines the application, and lists which settings came from **Its own file**, the **Central
list** and **Defaults**.

### When it is wrong

A push with a mistake keeps the last good settings and shows the error on the repository. The
error names the file and the field, such as `applications.2.group: No group called "order".
Create it in the catalog first.` on `.bemmoly/repository.yaml`.
While `.bemmoly/repository.yaml` itself does not read, no file in the repository is applied.

Removing an entry from `applications` archives that application on the next push, the way
deleting its `application.yaml` does. Deleting a folder's `application.yaml` while the
central list still has its entry keeps the application, now defined by the entry.

## 3. Build args

`build.args` maps a name to a value. A value may use:

- `${{ app.name }}`: the application's name, such as `orders`.
- `${{ app.path }}`: its folder, such as `services/orders`.
- `${{ inputs.<name> }}`: an input of the pipeline, from a template, a schedule or Run
  pipeline.

The runner passes each one to `docker build` as `--build-arg NAME=value`, quoted so the value
stays text, and the same on Kaniko in a GKE Autopilot pool.

**Secrets do not belong in build args.** Build args are written into the image's history,
where anyone who can pull the image can read them. A value may never name a variable or a
secret, and an arg whose name looks like a secret (`NPM_TOKEN`, `DB_PASSWORD`) may not take an
input. Give a step the secret with `secrets:` instead.

Push a change to `services/orders`. **You should see** a run with one build, and in its log
`docker build … --build-arg 'SERVICE=orders' …`.

## 4. Path filters and defaults

A push starts a run for each application it touches:

- A file in an application's folder always touches it. Its folder is one of its path filters
  whether you list it or not.
- A file matching any of its `paths` touches it. `paths` from `defaults` are added to every
  application's own.
- A `!` filter leaves files out, such as `'!**/*.md'`.

With the file above:

| The push changes | Runs start for |
| --- | --- |
| `services/orders/src/main.ts` | orders |
| `apps/web/src/app.tsx` | web |
| `packages/money/src/round.ts` | every application, since all of them list `packages/**` |
| `docs/readme.md` | nothing |

**You should see** exactly these in Runs after each push. A push the code host reports
without its file list starts every application: building too much is safe, missing one is not.

## 5. Libraries

An application whose pipeline neither builds an image nor deploys is a library. `money` above
is one: `build: null` turns the shared build off, and its `test` steps still come from
`defaults`. A push to `packages/money` runs its checks with the rest.

**You should see** on its page a **Library** badge in the Settings card, saying it is checked
on every push and makes no releases. Its runs pass or fail like any other, and nothing appears
in Releases for it.

## Try it without a repository

On a seeded install, `pnpm --filter @bemmoly/module-pipelines demo:monorepo` applies the files
in `modules/pipelines/scripts/demo/monorepo` as a push would, as `acme/market`. It also scans
the same tree without its Bemmoly files as `acme/market-next`.

**You should see** `market-orders`, `market-invoices`, `market-shipping`, `market-web` and
`market-money` in the Catalog, each page with its Settings card, and in Set up the repository
file proposed for `acme/market-next`.

## What is not covered yet

- Discovery proposes a repository file only when the repository has none. It never edits one.
- A UI edit to an application from the central list opens a pull request that edits its entry.
  It does not move a setting from `defaults` into the entry for you.
- Runners older than this release ignore build args. Update runners before relying on them.
