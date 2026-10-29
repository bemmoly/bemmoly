# Ship your own project with Pipelines

This guide takes one of your repositories from a push to a running Cloud Run service in your
own Google Cloud project, then promotes it to Prod and rolls it back. Everything runs on your
laptop except the service itself. Pipelines creates nothing in Google Cloud beyond the Cloud Run
service and its revisions. It attaches to a project you already have.

Plan on about an hour the first time. Each step says what you should see, so you can tell where
something went wrong.

## What you need

- **A Google Cloud project** you can deploy to, with billing on. Your own gcloud sign-in should
  have Owner or Editor there. A sandbox project is ideal.
- **gcloud** installed and signed in, and **Docker** running (Docker Desktop or Colima).
- **A GitHub repository** with a `Dockerfile` that builds a web service listening on the port
  you name below. Cloud Run sends traffic to `$PORT`, 8080 unless you choose another.
- **A tunnel** to your laptop, so GitHub's push webhooks reach it. A Cloudflare quick tunnel
  needs no account: `cloudflared tunnel --url http://localhost:8080`. Without one, nothing syncs
  your application file and nothing starts on a push; see "Without a tunnel" at the end.

## 1. Prepare the Google Cloud project

Set two variables, then turn on the APIs and make an image repository in the same project:

```sh
PROJECT=your-project-id
REGION=europe-west1
```

```sh
gcloud services enable run.googleapis.com artifactregistry.googleapis.com monitoring.googleapis.com iamcredentials.googleapis.com --project "$PROJECT"
```

```sh
gcloud artifacts repositories create apps --repository-format=docker --location="$REGION" --project="$PROJECT"
```

Let Bemmoly sign in as you, and let your laptop's Docker push to the repository:

```sh
gcloud auth application-default login
```

```sh
gcloud auth application-default set-quota-project "$PROJECT"
```

```sh
gcloud auth configure-docker "$REGION-docker.pkg.dev"
```

Keep the image repository in the same project as the service for this test. Cloud Run can then
pull from it with no extra grant.

## 2. Start Bemmoly with a public address

Start the tunnel and note the `https://…trycloudflare.com` address it prints. Put it in
`apps/server/.env` as the public address, then start Bemmoly:

```sh
echo "BEMMOLY_PUBLIC_URL=https://your-tunnel.trycloudflare.com" >> apps/server/.env
```

```sh
pnpm dev
```

Open http://localhost:5173 and finish the setup wizard if the database is new. You become the
workspace admin. Pipelines is at http://localhost:5173/pipelines/.

## 3. Connect GitHub

In Bemmoly, open Settings › Code hosts and add GitHub as a GitHub App, installed on your
repository. The webhook address it shows uses your tunnel, so pushes reach your laptop. Within
five minutes Pipelines lists the repository in Set up, step 2.

## 4. Connect your project

In Pipelines, open Platform › Clouds › Connect a cloud, choose Google Cloud, then **Use
projects I already have**. Choose **My gcloud sign-in on this machine** and your region. For the
image registry, enter:

```
<REGION>-docker.pkg.dev/<PROJECT>/apps
```

Then **Attach a project** with your project ID. Leave both service accounts empty: Pipelines
acts as your own sign-in, and services run as the project's default account.

**You should see** the project as Ready. If it shows problems, each one says what to turn on or
grant. Fix them and press Check again.

## 5. Make somewhere to deploy

In Platform › Environments, create two environments, both in the project you attached:

| Name | Class | Notes |
| --- | --- | --- |
| Dev | dev | |
| Prod | prod | It is protected and asks for an approval. On your own, clear **Needs an approval**: Pipelines never lets the person who asked approve their own promotion |

Then edit the path for your application's tier. New applications are Tier 2. Put Dev at stage 0
with **Auto-promote** on, and Prod at stage 1.

## 6. Describe the application

Add `.bemmoly/application.yaml` to the repository, or accept the proposal Set up offers and edit
the file it opens. The `group` must be one in the Catalog; create one there if you have none.

```yaml
name: shop
group: web
tier: 2
pipeline:
  build:
    dockerfile: Dockerfile
  test:
    - name: Unit tests
      image: node:24
      run: npm ci && npm test
  deploy:
    kind: container-service
    port: 8080
    resources: { cpu: 1, memory: 512Mi }
    public: true
```

`public: true` lets anyone call the service. Your organization may forbid that. If so, the
deploy says why, and you can drop the line and call the service with
`curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" <url>`.

## 7. Start a runner

In Platform › Capacity, add a pool with the key `linux-x64`. That is the default pool, so
pipelines that name none run there. Copy its token, then start a runner from the repository root:

```sh
node apps/runner/src/main.ts --url http://localhost:8080 --pool-token <token> --data-dir /tmp/bemmoly-runner
```

Steps run as containers in Docker. The build runs Docker on your laptop and pushes with your own
Docker credentials.

## 8. Push, and watch it reach Dev

Push the file, or any change, to the default branch.

**You should see**:

1. A run in Runs: check out, build, unit tests.
2. The build log ending with the push and a `digest: sha256:…` line. On an ARM Mac the image is
   built for `linux/amd64`, which Cloud Run needs. That is slower, because Docker emulates it.
3. A release in Releases, then within a minute a promotion to Dev that nobody asked for. Its
   note says the path auto-promotes.
4. The service in the Cloud Run console, and its address on the application's page.

## 9. Promote to Prod, then roll back

On the application's page, press Promote and choose Prod.

- **The first deploy to Prod** takes all its traffic at once: there is nothing to compare a
  canary against.
- **Push another change**, let it reach Dev, and promote it. Prod now rolls out as a canary,
  with a share of traffic first. With little traffic there is too little to judge it. After
  about ten minutes the rollout pauses and asks you to continue or roll back. Send the service
  some requests first if you want the canary judged.
- **Press Roll back** on the application's page. Every request goes back to the previous
  revision at once.

## What to send back

For each step, whether it did what "You should see" says. When it did not, send the sentence
the screen or log showed. Things worth trying on purpose:

- **Attach a project you cannot see.** You should get one sentence saying what to grant.
- **Clear the registry and push again.** The deploy should refuse an image that never left
  your laptop, and say what to do.
- **Archive Dev while a promotion to it is open.** It should be refused with a reason.

## Without a tunnel

Pipelines then never hears about pushes. Runs only start from Run pipeline on the application's
page, and changes to `.bemmoly/application.yaml` do not reach Pipelines. Use a tunnel for this
test. A "sync now" action for installs GitHub cannot reach is a known gap.
