# Bemmoly on one VM, with Terraform

Terraform for the same install the one-line installer does: one Linux VM, ports 80 and 443
open, and `curl -fsSL https://get.bemmoly.com | sh` run on first boot through cloud-init.
Bemmoly runs in Docker Compose on that VM (app, Postgres 18 with pgvector, the Caddy proxy and
the optional updater), exactly as after a manual install, so the `bemmoly` CLI, in-app
updates and backups work the same way.

```
deploy/terraform/
├── modules/bemmoly-vm/   provider-free: renders the cloud-config and recommends a VM size
├── examples/aws/         EC2 + security group (+ Elastic IP)
├── examples/gcp/         Compute Engine + firewall rules (+ static address)
├── examples/hetzner/     Hetzner Cloud server + firewall
└── check.sh              fmt, validate, mocked tests and TFLint, with no cloud access
```

On Kubernetes, use the Helm chart in `deploy/helm/bemmoly` instead.

## The module

`modules/bemmoly-vm` creates nothing. It turns a few inputs into the user data any cloud's
VM accepts, so the examples stay thin and another cloud needs only its own VM and firewall.
On first boot the cloud-config:

1. installs `curl` from the distribution's packages;
2. runs the installer with `--yes --domain <domain> --channel <channel>`, plus `--version`,
   `--modules` and `--no-in-app-updates` when you set them;
3. when SMTP or S3 inputs are given, writes them to `/root/bemmoly-settings.json` (root only,
   mode 0600), runs `bemmoly settings import` on it, and deletes the file.

| Input                 | Type         | Default  | Meaning                                                                                                                                                              |
| --------------------- | ------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `domain`              | string       | required | Hostname people will use, such as `bemmoly.example.com`                                                                                                              |
| `size`                | string       | `medium` | `small`, `medium` or `large`; see the sizing table                                                                                                                   |
| `bemmoly_version`     | string       | `latest` | `1.2.0`, `latest` (newest in the channel) or `beta`                                                                                                                  |
| `channel`             | string       | `stable` | Update channel: `stable` or `beta`                                                                                                                                   |
| `modules`             | list(string) | `[]`     | Modules to enable, such as `["work", "docs"]`; empty leaves it to the setup wizard                                                                                   |
| `in_app_updates`      | bool         | `true`   | `false` installs without the updater; update with `sudo bemmoly upgrade`                                                                                             |
| `ssh_authorized_keys` | list(string) | `[]`     | Public keys for the image's default user                                                                                                                             |
| `smtp`                | object       | `null`   | `host`, `port` (587), `security` (`starttls`, `tls` or `none`), `username`, `password`, `from`, `reply_to`                                                           |
| `backups_s3`          | object       | `null`   | `endpoint` (for S3-compatible services), `region` (`us-east-1`), `bucket`, `prefix` (`bemmoly/`), `access_key_id`, `secret_access_key`, `force_path_style` (`false`) |

Bad values fail at `terraform plan` with the same rules the installer applies, before a VM
exists.

| Output       | Meaning                                               |
| ------------ | ----------------------------------------------------- |
| `user_data`  | The cloud-config (sensitive)                          |
| `sizing`     | `{ vcpu, memory_gb, disk_gb }` recommended for `size` |
| `public_url` | `https://<domain>`                                    |

### Sizing

| `size`   | Team        | vCPU | Memory | Disk  | AWS          | Google Cloud       | Hetzner |
| -------- | ----------- | ---- | ------ | ----- | ------------ | ------------------ | ------- |
| `small`  | up to 50    | 1    | 2 GB   | 30 GB | `t3.small`   | `e2-small`         | `cx23`  |
| `medium` | up to 200   | 2    | 4 GB   | 40 GB | `t3.medium`  | `e2-medium`        | `cx23`  |
| `large`  | up to 1,000 | 4    | 8 GB   | 80 GB | `c7i.xlarge` | `e2-custom-4-8192` | `cx33`  |

The disk holds the images, the database, uploads and the local backups (seven daily, four
weekly and three monthly by default). Each example takes an override (`instance_type`,
`machine_type`, `server_type`) when you want another type. Hetzner's smallest current x86 type
already has 2 vCPU and 4 GB, and its disk comes with the type.

Beyond about 1,000 people, the tech design recommends Postgres on its own machine. These
examples keep the bundled database on the VM; an external Postgres 18 with pgvector can be
used later through the installer's `--database-url` option.

## Using an example

Work inside the example folder of a checkout, or copy it elsewhere and point its module at a
release instead of the relative path:

```hcl
source = "github.com/bemmoly/bemmoly//deploy/terraform/modules/bemmoly-vm?ref=v1.2.0"
```

Then, from inside the folder:

```sh
cat > terraform.tfvars <<'EOF'
domain          = "bemmoly.example.com"
size            = "medium"
ssh_cidr_blocks = ["203.0.113.4/32"]   # gcp: ssh_source_ranges, hetzner: ssh_source_ips
EOF

terraform init
terraform plan
terraform apply
```

Credentials come from each provider's usual sources, never from these files:

- **AWS**: `aws configure` or `AWS_PROFILE`. Set `region`; `vpc_id` and `subnet_id` default to
  the default VPC. `key_name` names an existing key pair.
- **Google Cloud**: `gcloud auth application-default login`. Set `project` (and `region`,
  `zone` if not `us-central1`).
- **Hetzner**: `export HCLOUD_TOKEN=...` with a read and write token for the project.
  `ssh_keys` names keys already uploaded to the project.

SSH stays closed unless you list source ranges. The examples ignore later changes to the image
and the user data on purpose: cloud-init runs only on the first boot, and replacing the VM to
apply them would discard its data. After the first boot, change settings in the app or with
the `bemmoly` CLI.

### DNS

`terraform apply` prints `dns_record` (Hetzner: `dns_records`). Create that A record (and the
optional AAAA record on Hetzner) at your DNS provider. The installer does not wait for DNS: it
starts with a self-signed certificate, and the proxy keeps asking for a real one, which arrives
soon after the name resolves to the VM (`sudo bemmoly doctor` then confirms it). Open the
printed `url` to create the first admin.

The install takes a few minutes after the VM boots. To follow it, SSH in and run
`sudo tail -f /var/log/cloud-init-output.log`; `sudo bemmoly status` shows the result.

## Secrets in user data

SMTP and S3 credentials passed to the module end up in the VM's user data. Terraform marks it
sensitive, but it is also stored in the Terraform state and in the cloud's instance metadata,
where any process on the VM, and anyone with read access to the instance in the cloud account,
can read it. The file the installer imports is deleted; the user data is not.

To keep them out entirely, leave `smtp` and `backups_s3` null and enter them in the setup
wizard or under Settings after the install, where they are encrypted with the install's
secret key. If you do pass them, keep the state in an encrypted backend with restricted access,
and rotate the credentials if the state or the instance metadata may have been exposed. The AWS
example requires IMDSv2 tokens, which blocks the most common way of reading metadata through a
forged request.

## Checks

`sh deploy/terraform/check.sh` runs, for the module and each example, `terraform fmt -check`,
`terraform init -backend=false`, `terraform validate`, `terraform test` and TFLint, and holds
every file to 300 lines. The example tests use mocked providers, so they need no credentials
and create nothing. The script uses a local `terraform` 1.16.4 and `tflint` 0.64.0 when those
exact versions are installed, and the pinned Docker images otherwise. Pass folders to check
only those, such as `sh deploy/terraform/check.sh examples/aws`.
