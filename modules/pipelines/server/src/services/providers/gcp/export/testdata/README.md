# Acme Google Cloud

Everything Bemmoly Pipelines created and deployed through this connection, as Terraform and
Helm you can run without Pipelines. Nothing here holds a secret value.

## Terraform

`terraform/` declares what exists today, with an import block for each of the 34
resources so Terraform adopts them instead of creating them again. The values that differ
per company are in `terraform.tfvars`.

```sh
cd terraform
terraform init
terraform plan
```

You should see `Plan: 34 to import, 0 to add, 0 to change, 0 to destroy.` Run
`terraform apply` to record them in your state. From then on, change them here.

## Before you plan

- payments-worker in prod: a deploy after v2.1.0 did not finish, so what runs may be newer than this export. A plan or helm diff shows it going back to v2.1.0; apply only if that is what you want.

## Helm

- `helm/checkout/`: the checkout namespace. Install the Gateway, then each application:

  ```sh
  helm upgrade --install checkout-gateway helm/checkout -n checkout -f helm/checkout/values/ENV/gateway.yaml
  helm upgrade --install APP helm/checkout -n checkout -f helm/checkout/values/ENV/APP.yaml
  ```

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
- The front door. Pipelines makes no load balancers yet; terraform/front-door.tf is where they will go.
- Build machines. A Cloud Build pool leaves nothing behind to import; terraform/build-pools.tf lists how each pool starts them.
- gift-cards in staging: staging has no Google Cloud project yet; apply the landing zone first.
