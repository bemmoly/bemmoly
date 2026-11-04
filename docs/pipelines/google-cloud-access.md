# Google Cloud access

What Bemmoly Pipelines holds in Google Cloud, where, and why, for each way of connecting. Every
grant is the narrowest Google offers for what Pipelines does with it: a role on one resource
where the resource has its own policy, a project role only where nothing narrower exists.
Pipelines never holds a service account key.

## Bemmoly creates the projects

`deploy/gcp/bootstrap.sh` grants the control identity (the account Bemmoly signs in as) its
roles. The landing zone then grants each project's own accounts theirs.

**The control identity**

| Role                                    | Where                         | Why                                                                                                                                                                         |
| --------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Folder Creator                          | Bemmoly folder, until --lock  | A folder per domain in the per-domain layouts.                                                                                                                              |
| Project Creator                         | Bemmoly folder, until --lock  | A project per environment. Google makes the creator Owner of each project, which is how Pipelines manages what is inside it.                                               |
| Billing Project Manager                 | Bemmoly folder, until --lock  | Links each new project to the billing account, with Billing Account User.                                                                                                   |
| Service Usage Admin                     | Bemmoly folder, until --lock  | Turns on the APIs each landing zone needs.                                                                                                                                  |
| Service Account Admin                   | Bemmoly folder, until --lock  | Creates each project's deployer and runtime accounts and sets who may act as them.                                                                                          |
| Project IAM Admin                       | Bemmoly folder, until --lock  | Grants the project roles below.                                                                                                                                             |
| Folder Viewer                           | Bemmoly folder                | Reads the folder tree for the map and the nightly drift scan.                                                                                                               |
| Billing Account User                    | Billing account               | Links projects to the account.                                                                                                                                              |
| Billing Costs Manager                   | Billing account               | A budget per environment, and spend for the cost views.                                                                                                                     |
| Artifact Registry Administrator         | Control project               | Creates the shared repository and sets who may push and pull. The only role with both repositories.create and setIamPolicy. The control project is made by you, not Pipelines, so it is not Owner there. |
| Logs Configuration Writer               | Control project               | Sets how long the control project's logs are kept. The narrowest role with logging.buckets.update.                                                                          |
| Service Account Token Creator           | Each `deployer@` account      | Every deploy acts as that project's deployer, so the project's audit log names the deployer.                                                                                |

`--lock` removes the six provisioning roles once the landing zones exist; `--unlock` puts them
back. Earlier versions also granted Token Creator on the whole folder, which let the control
identity act as any account there. The bootstrap now names that grant, if it is still there,
with the command that removes it. Remove it once every deployer shows as impersonated.

**Inside each project**

| Account    | Role                                                                 | Where                       | Why                                                                                                          |
| ---------- | -------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `deployer` | Cloud Run Admin                                                      | Its project                 | Deploys services. Admin, not Developer: a public service needs its invoker policy set.                       |
| `deployer` | Monitoring Viewer                                                    | Its project                 | Reads error rates and latency for canaries.                                                                  |
| `deployer` | Service Account User                                                 | The `runtime` account alone | Starts services that run as `runtime`. On the project it would let the deployer act as any account there.   |
| `deployer` | Kubernetes Engine Developer                                          | Its project, with GKE       | Deploys into the cluster Pipelines made there. GKE has no per-cluster role.                                  |
| `runtime`  | Logs Writer, Monitoring Metric Writer, Cloud Trace Agent             | Its project                 | What a running service writes about itself.                                                                  |
| `runtime`  | Artifact Registry Reader                                             | The shared repository       | Pulls release images, with the project's Cloud Run service agent.                                            |
| `runtime`  | Secret Manager Secret Accessor                                       | Each secret it reads        | Granted at each deploy on exactly the secrets the revision names.                                            |
| `builder`  | Logs Writer                                                          | The platform project        | Build logs.                                                                                                  |
| `builder`  | Artifact Registry Writer                                             | The shared repository       | Pushes the images it builds, to that repository alone.                                                       |

Landing zones made before this version also hold Service Account User and Secret Accessor on
the whole project for the deployer and runtime account, and Artifact Registry Writer on the
platform project for the builder. They still work and nothing removes them. The drift scan shows
the narrow deployer grant as missing, and applying the landing zone adds it; after that the
project-wide ones can go.

## Attach projects you already have

Connect a cloud shows one command that grants these to whoever Bemmoly signs in as. With a
folder or organization, the project roles go on it once and every project under it inherits
them; the rest are granted in each project the command finds, so run it again after adding a
project. "Check access" tests each grant on the resource it belongs on.

| Role                                         | Where                                  | Why                                                                                                                                       |
| -------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Cloud Run Admin                              | Each project, or the folder            | Deploys services and reads the project's number and name. Admin, not Developer, so a public service can have its invoker policy set.      |
| Cloud Build Editor                           | Each project, or the folder            | Starts, follows and cancels build jobs there. Builds are project resources.                                                               |
| Monitoring Viewer                            | Each project, or the folder            | Reads error rates and latency for canaries.                                                                                               |
| Service Account User                         | The account services run as, alone     | Starts services that run as it: `PROJECT_NUMBER-compute@developer.gserviceaccount.com`, or the runtime account named on attach.           |
| Bemmoly secrets (`projects/P/roles/bemmolySecrets`) | Each project                    | A custom role with only secrets.create, secrets.get, secrets.getIamPolicy, secrets.setIamPolicy, versions.add, versions.get and versions.access. Secret Manager Admin is the only predefined role that can create a secret and set its policy, and it can also delete and destroy every secret. |

Not granted, and why:

- **Browser.** Cloud Run Admin already reads the project.
- **Artifact Registry Writer.** Pipelines never calls the registry in an attached project.
  Runners push with their own machine's credentials, so the account a runner runs as needs
  Artifact Registry Writer on your repository, and Cloud Run's service agent needs Reader on it
  if it is in another project.
- **A build account.** If a pool names its own build service account, grant Bemmoly Service
  Account User on that account, as [Build machines](build-machines.md) shows.

Only a missing Cloud Run grant, Service Account User on the runtime account, or the Cloud Run
API fails the check. The rest show as warnings with the grant that fixes each, so a project
granted the older, broader way still passes.
