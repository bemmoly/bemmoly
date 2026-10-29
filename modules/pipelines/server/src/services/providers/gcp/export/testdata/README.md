# Acme Google Cloud

Everything Bemmoly Pipelines created and deployed through this connection, as Terraform and
Helm you can run without Pipelines. Nothing here holds a secret value.

## Terraform

`terraform/` declares what exists today, with an import block for each of the 46
resources so Terraform adopts them instead of creating them again. The values that differ
per company are in `terraform.tfvars`.

```sh
cd terraform
terraform init
terraform plan
```

You should see `Plan: 46 to import, 0 to add, 0 to change, 0 to destroy.` Run
`terraform apply` to record them in your state. From then on, change them here.

## Before you plan

- Traffic is still shifting on checkout-api.prod.acme.example in prod, so each is exported with all of it on the backend that takes most now. A plan shows the weights changing; apply once the move or canary ends.
- A deploy did not finish since the exported release of payments-worker in prod, so what runs there may be newer than this export. A plan or helm diff shows it going back; apply only if that is what you want.

## Helm

- `helm/checkout/`: the checkout namespace. Install the Gateway, then each application:

  ```sh
  helm upgrade --install checkout-gateway helm/checkout -n checkout -f helm/checkout/values/ENV/gateway.yaml
  helm upgrade --install APP helm/checkout -n checkout -f helm/checkout/values/ENV/APP.yaml
  ```
- `helm/runner-pools/`, the gke-runners pool: `helm upgrade --install gke-runners helm/runner-pools -n bemmoly-runners-gke-runners -f helm/runner-pools/values/gke-runners.yaml`

`helm template` shows what each would apply. Objects Pipelines made carry its labels; to let
Helm take them over in place, label and annotate them first:

```sh
kubectl -n NAMESPACE label deployment,service,httproute,secretproviderclass,serviceaccount,gateway \
  -l app.kubernetes.io/managed-by=bemmoly-pipelines app.kubernetes.io/managed-by=Helm --overwrite
kubectl -n NAMESPACE annotate deployment,service,httproute,secretproviderclass,serviceaccount \
  -l app.kubernetes.io/name=APP meta.helm.sh/release-name=APP meta.helm.sh/release-namespace=NAMESPACE
kubectl -n NAMESPACE annotate gateway bemmoly \
  meta.helm.sh/release-name=NAMESPACE-gateway meta.helm.sh/release-namespace=NAMESPACE
```

## Left out

- Revision history. Cloud Run and GKE keep earlier revisions so Pipelines can roll back; the export holds only the one serving traffic.
- The canary's weights while one is moving. Cloud Run's traffic is ignored by Terraform, and each HTTPRoute sends all traffic to the serving revision.
- Secret values. They live only in Secret Manager; the export names each secret and the version a service reads.
- The workload identity federation pool and the control project. bootstrap.sh made them, so they are already yours.
- The weights of a move between runtimes while one is under way. The front door's URL map sends all of a moving host's traffic to the backend that takes most of it now.
- GKE's zonal endpoint groups for the front door. GKE makes them from each Service's annotation, so Terraform reads them instead of declaring them.
- Build machines. A Cloud Build pool leaves nothing behind to import, and an Autopilot pool's job pods and warm room start and stop with its jobs; terraform/build-pools.tf lists how each pool starts them.
- gift-cards in staging: staging has no Google Cloud project yet; apply the landing zone first.
