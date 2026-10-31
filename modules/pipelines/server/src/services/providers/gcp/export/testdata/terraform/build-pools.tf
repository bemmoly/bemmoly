# Runner pools: how each starts its machines, and what an Autopilot pool keeps.

# How each runner pool starts its machines. A Cloud Build pool leaves nothing behind to
# import; an Autopilot pool keeps the cluster and the binding below.
locals {
  runner_pools = {
    cloud_build = {
      image           = "us-docker.pkg.dev/acme-ci-7f3a/bemmoly/runner:1"
      kind            = "cloud-build"
      machine         = "e2-highcpu-8"
      project         = "acme-ci-7f3a"
      region          = "us-central1"
      service_account = "builder@acme-ci-7f3a.iam.gserviceaccount.com"
    }
    gke_runners = {
      builder_image   = "gcr.io/kaniko-project/executor:v1.23.2-debug"
      cluster         = "bemmoly-runners"
      cpu             = 2
      image           = "us-docker.pkg.dev/acme-ci-7f3a/bemmoly/runner-gke:1"
      kind            = "gke-autopilot"
      location        = "us-central1"
      memory_gb       = 8
      namespace       = "bemmoly-runners-gke-runners"
      project         = "acme-ci-7f3a"
      service_account = "builder@acme-ci-7f3a.iam.gserviceaccount.com"
      spot            = true
    }
  }
}

# The Autopilot cluster the gke-runners pool's pods run on.
resource "google_container_cluster" "bemmoly_runners" {
  project          = google_project.acme_ci_7f3a.project_id
  location         = "us-central1"
  name             = "bemmoly-runners"
  enable_autopilot = true
  resource_labels = {
    bemmoly-pool    = "gke-runners"
    bemmoly-purpose = "runners"
  }
  release_channel {
    channel = "REGULAR"
  }
  maintenance_policy {
    recurring_window {
      start_time = "2026-01-03T01:00:00Z"
      end_time   = "2026-01-03T09:00:00Z"
      recurrence = "FREQ=WEEKLY;BYDAY=SA,SU"
    }
  }
  workload_identity_config {
    workload_pool = "${var.projects.acme_ci_7f3a}.svc.id.goog"
  }
  gateway_api_config {
    channel = "CHANNEL_STANDARD"
  }
  secret_manager_config {
    enabled = true
  }
  ip_allocation_policy {}
}

# Lets the gke-runners pool's pods act as builder@acme-ci-7f3a.iam.gserviceaccount.com.
resource "google_service_account_iam_member" "gke_runners_pods" {
  service_account_id = "projects/acme-ci-7f3a/serviceAccounts/builder@acme-ci-7f3a.iam.gserviceaccount.com"
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.projects.acme_ci_7f3a}.svc.id.goog[bemmoly-runners-gke-runners/bemmoly-runner]"
}
