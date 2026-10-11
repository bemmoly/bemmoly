# The provider reads the API token from HCLOUD_TOKEN, so it never sits in a tfvars file.
provider "hcloud" {}

module "bemmoly" {
  source = "../../modules/bemmoly-vm"

  domain              = var.domain
  size                = var.size
  bemmoly_version     = var.bemmoly_version
  channel             = var.channel
  modules             = var.modules
  in_app_updates      = var.in_app_updates
  smtp                = var.smtp
  backups_s3          = var.backups_s3
  ssh_authorized_keys = var.ssh_authorized_keys
}

locals {
  # Hetzner's smallest current x86 type already has 2 vCPU and 4 GB, so small and medium share
  # it. The disk comes with the type (40 GB and 80 GB), which covers each size's sizing.disk_gb.
  server_types = {
    small  = "cx23"
    medium = "cx23"
    large  = "cx33"
  }
  server_type = coalesce(var.server_type, local.server_types[var.size])
  labels      = merge({ application = "bemmoly" }, var.labels)
  everyone    = ["0.0.0.0/0", "::/0"]
}

resource "hcloud_firewall" "bemmoly" {
  name   = var.name
  labels = local.labels

  # Port 80 stays open: the proxy answers the certificate authority's HTTP challenge on it and
  # redirects everything else to HTTPS.
  rule {
    description = "HTTP"
    direction   = "in"
    protocol    = "tcp"
    port        = "80"
    source_ips  = local.everyone
  }

  rule {
    description = "HTTPS"
    direction   = "in"
    protocol    = "tcp"
    port        = "443"
    source_ips  = local.everyone
  }

  dynamic "rule" {
    for_each = length(var.ssh_source_ips) > 0 ? [var.ssh_source_ips] : []

    content {
      description = "SSH"
      direction   = "in"
      protocol    = "tcp"
      port        = "22"
      source_ips  = rule.value
    }
  }
}

resource "hcloud_server" "bemmoly" {
  name         = var.name
  server_type  = local.server_type
  image        = "ubuntu-24.04"
  location     = var.location
  ssh_keys     = var.ssh_keys
  firewall_ids = [hcloud_firewall.bemmoly.id]
  user_data    = module.bemmoly.user_data
  labels       = local.labels

  public_net {
    ipv4_enabled = true
    ipv6_enabled = true
  }

  # Changing user data or the image replaces a Hetzner server, and its data with it.
  # Cloud-init only runs on the first boot; later changes go through Settings or the CLI.
  lifecycle {
    ignore_changes = [user_data, image]
  }
}
