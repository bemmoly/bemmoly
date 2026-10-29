# Let Pipelines create your Google Cloud projects

This guide starts from an empty Google Cloud organization and ends with a service running in
Prod. A setup script makes one folder and grants Bemmoly roles on that folder alone. Pipelines
then creates the projects inside it: Starter is a platform project, one for non-production and
one for production, with a shared image registry and a deployer and runtime identity in each.
From there it is the same push to Dev and promotion to Prod as
[shipping to a project you already have](your-own-project.md).

The goal is under 45 minutes from an empty organization to a Prod deploy. The times below are
estimates; write down what each step really took.

**What has been tested.** Every call Pipelines makes to Google Cloud in this guide has only met
hand-written answers shaped from Google's REST reference, and the screens have only met the
cloud simulator. Nothing here has run against a real organization yet. That is what this guide
is for. The last section says how to capture real answers for the tests while you are at it.

## What you need

- **A sandbox Google Cloud organization**, empty. Cloud Identity Free is enough to have one.
  Google only lets a service account create projects inside an organization.
- **Your own account** as Organization Administrator and Billing Account Administrator there.
- **A billing account** with room for three projects. New billing accounts can often pay for
  only five projects in all; see "If the billing account is full".
- **gcloud** signed in as that account, **Docker** running, a **GitHub repository** with a
  `Dockerfile`, and a **tunnel** to your laptop, as in the
  [attached guide](your-own-project.md#what-you-need).

## 1. Run the bootstrap (about 5 minutes)

Bemmoly runs on your laptop for this test and signs in to Google Cloud as you. Find your
organization and billing account:

```sh
gcloud organizations list
```

```sh
gcloud billing accounts list
```

See what the bootstrap would do, changing nothing:

```sh
sh deploy/gcp/bootstrap.sh --org <ORG_ID> --billing <BILLING_ACCOUNT> --mode none --member user:<you@example.com> --dry-run
```

**You should see** every gcloud command it would run, each marked `[dry run]`: a folder named
Bemmoly, a project named `bemmoly-control-<ORG_ID>`, the roles on the folder and on the billing
account, and "nothing was changed" at the end.

Run it for real:

```sh
sh deploy/gcp/bootstrap.sh --org <ORG_ID> --billing <BILLING_ACCOUNT> --mode none --member user:<you@example.com>
```

**You should see** it end with the values for Connect:

```
Paste these into Pipelines › Platform › Clouds › Connect a cloud › Create projects for me:

  Folder ID:         417302018845
  Billing account:   01A2B3-C4D5E6-F7A8B9
  Control project:   bemmoly-control-583920174411
  Default region:    us-central1
  Sign in with:      My gcloud sign-in on this machine
```

Run it a second time. **You should see** every step marked as already in place, and no command
that changes anything.

Then let Bemmoly use your sign-in, billed to the control project:

```sh
gcloud auth application-default login
```

```sh
gcloud auth application-default set-quota-project <CONTROL_PROJECT>
```

`--member user:…` gives the folder and billing roles to you, because Bemmoly signs in as you on
a laptop. Without it they go to the control identity `bemmoly-control@<CONTROL_PROJECT>`, which
is what a VM or workload identity federation signs in as. To run Bemmoly on a VM in the control
project instead, drop `--mode none` and `--member`; the bootstrap creates the VM and installs
Bemmoly on it.

## 2. Start Bemmoly and connect GitHub (about 5 minutes)

Do steps 2 and 3 of the [attached guide](your-own-project.md#2-start-bemmoly-with-a-public-address):
start the tunnel, start Bemmoly with its address, and install the GitHub App on your repository.

## 3. Make the environments (about 2 minutes)

A landing zone makes projects for the environments that exist, so make them first. In
Platform › Environments, create two, and leave **Project** empty in both:

| Name | Class |
| --- | --- |
| Dev | dev |
| Prod | prod |

Prod starts protected and asking for an approval. On your own, clear **Needs an approval**:
Pipelines never lets the person who asked approve their own promotion.

**You should see** both environments with no project yet.

## 4. Connect and choose Starter (about 3 minutes)

Open Platform › Clouds › Connect a cloud, choose Google Cloud, then **Create projects for me**.
Fill in the folder ID, billing account and control project the bootstrap printed, keep the
region, choose **My gcloud sign-in on this machine**, and press **Connect and check**.

**You should see** "The folder grant" say **Bemmoly holds what it needs**. If it lists
problems, each one names the role to grant and where. Grant it, or run the bootstrap again,
then press **Check again**.

**Starter** is chosen. **You should see** the plan beside it:

- the Bemmoly folder, with your control project as the platform project holding the registry,
  the build identity and its logs;
- `<name>-nonprod-<suffix>` for Dev, and `<name>-prod-<suffix>` for Prod, each with its
  services, a network, a deployer and a runtime identity, pull access to the registry, a secret
  store and logs;
- a line saying how many projects the billing account pays for and that this plan adds 2.

Choose **Standard** and **Enterprise** to compare, then go back to **Starter**.

## 5. Create the projects (about 5 to 10 minutes)

Press **Create 2 projects**. **You should see** each project go from Planned to Ready, then
**The landing zone is ready**. In the Google Cloud console, the Bemmoly folder now holds the two
new projects, and the control project has an Artifact Registry repository named `apps`.

If it stops, the page says why in one sentence with **Retry**. Retry starts where it stopped
and creates nothing twice. A new project's permissions can take a minute or two to settle, so a
first stop on a permission is worth one Retry before anything else.

**You should see** in Platform › Environments that Dev deploys into the non-production project
and Prod into the production one, and on the connection's card in Platform › Clouds that runners
push to `<region>-docker.pkg.dev/<CONTROL_PROJECT>/apps`.

Let your laptop's Docker push there:

```sh
gcloud auth configure-docker <REGION>-docker.pkg.dev
```

## 6. Push to Dev and promote to Prod (about 20 minutes)

Follow steps 5 to 9 of the [attached guide](your-own-project.md#5-make-somewhere-to-deploy),
skipping the environments, which exist already: set the path for your application's tier (Dev
at stage 0 with **Auto-promote**, Prod at stage 1), add `.bemmoly/application.yaml`, start a
runner, push, then promote to Prod and roll back.

**You should see** the same as there, with two differences: the service runs in the project
Pipelines made for that environment, and every deploy acts as that project's
`deployer@<project>` identity, so the project's audit log names the deployer, not you.

## Changing the layout later

Any layout can be chosen again from **Change the layout** on the connection's card. The plan
shows what would change before anything does, and Pipelines never deletes a project:

- **Projects the new layout needs** are created, as on the first apply.
- **Each environment moves** to its new project. The plan lists every move. The next deploy of
  each service goes to the new project; what already runs in the old one keeps running.
- **Projects the new layout no longer uses** are marked **Kept** in the plan and left exactly
  as they are. Delete them in Google Cloud once nothing runs there.
- **Data never moves.** Databases, buckets and queues in an old project stay there.

So going from Starter to Standard adds a CI project and a project per environment, moves Dev
and Prod, and keeps the two Starter projects until you delete them.

## If the billing account is full

Google publishes no API for how many projects a billing account may pay for, and does not
document the default. New accounts can often pay for only five. The plan counts what the
account pays for now and warns when the plan would pass five. If Google refuses to link a
project, the apply stops with a sentence pointing at Google's request form,
https://support.google.com/code/contact/billing_quota_increase. Once Google raises it, press
**Retry**.

## Capture real answers for the tests

The tests replay hand-written Google Cloud answers. While your sandbox is set up, capture real
ones, as `modules/pipelines/server/src/clients/gcp/fixtures/README.md` describes:

```sh
pnpm --filter @bemmoly/module-pipelines capture:gcp --folder <FOLDER_ID> --billing <BILLING_ACCOUNT> --control-project <CONTROL_PROJECT> --out /tmp/captured-gcp
```

It only reads. Send the files back with the rest.

## What to send back

For each step, how long it took and whether it did what "You should see" says. When it did not,
send the sentence the screen or log showed. Things worth trying on purpose:

- **Run the bootstrap without `--member`** and connect with your own sign-in. The check should
  list each missing role as one sentence.
- **Stop an apply part way**, for example by turning off the Cloud Billing API in the control
  project, then turn it on and press Retry. Nothing should be created twice.
- **Preview a switch to Standard** and check the moves and kept projects it lists.
