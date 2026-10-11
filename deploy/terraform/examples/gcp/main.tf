provider "google" {
  project = var.project
  region  = var.region
  zone    = var.zone
}

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
  # Shared-core E2 types for the two smaller sizes, where a team's load comes in bursts; the
  # large size is a custom E2 shape with exactly the 4 vCPU and 8 GB the sizing table asks for.
  machine_types = {
    small  = "e2-small"
    medium = "e2-medium"
    large  = "e2-custom-4-8192"
  }
  machine_type = coalesce(var.machine_type, local.machine_types[var.size])
  labels       = merge({ application = "bemmoly" }, var.labels)
  public_ip    = google_compute_instance.bemmoly.network_interface[0].access_config[0].nat_ip
}

# Port 80 stays open: the proxy answers the certificate authority's HTTP challenge on it and
# redirects everything else to HTTPS.
resource "google_compute_firewall" "web" {
  name          = "${var.name}-web"
  network       = var.network
  direction     = "INGRESS"
  source_ranges = ["0.0.0.0/0"]
  target_tags   = [var.name]

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }
}

resource "google_compute_firewall" "ssh" {
  count = length(var.ssh_source_ranges) > 0 ? 1 : 0

  name          = "${var.name}-ssh"
  network       = var.network
  direction     = "INGRESS"
  source_ranges = var.ssh_source_ranges
  target_tags   = [var.name]

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }
}

resource "google_compute_address" "bemmoly" {
  count = var.static_ip ? 1 : 0

  name   = var.name
  region = var.region
  labels = local.labels
}

resource "google_compute_instance" "bemmoly" {
  name                      = var.name
  zone                      = var.zone
  machine_type              = local.machine_type
  tags                      = [var.name]
  labels                    = local.labels
  allow_stopping_for_update = true

  boot_disk {
    initialize_params {
      # The image family resolves to the newest Ubuntu 24.04 LTS build at creation time.
      image = "ubuntu-os-cloud/ubuntu-2404-lts-amd64"
      size  = module.bemmoly.sizing.disk_gb
      type  = "pd-balanced"
    }
  }

  network_interface {
    network    = var.network
    subnetwork = var.subnetwork

    access_config {
      nat_ip = var.static_ip ? google_compute_address.bemmoly[0].address : null
    }
  }

  # Ubuntu's cloud-init reads the user-data key on the first boot.
  metadata = {
    user-data = module.bemmoly.user_data
  }

  shielded_instance_config {
    enable_secure_boot = true
  }

  # A newer image build or edited user data would otherwise replace the VM and its data.
  # Cloud-init only runs on the first boot; later changes go through Settings or the CLI.
  lifecycle {
    ignore_changes = [boot_disk[0].initialize_params[0].image, metadata["user-data"]]
  }
}
