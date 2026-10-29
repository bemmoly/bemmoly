# GKE clusters Pipelines created. What runs in them is in the Helm charts.

# prod's cluster, GKE Autopilot.
resource "google_container_cluster" "bemmoly_prod" {
  project          = google_project.acme_prod_7f3a.project_id
  location         = "us-central1"
  name             = "bemmoly-prod"
  enable_autopilot = true
  resource_labels = {
    environment = "prod"
    managed-by  = "bemmoly"
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
    workload_pool = "${var.projects.acme_prod_7f3a}.svc.id.goog"
  }
  gateway_api_config {
    channel = "CHANNEL_STANDARD"
  }
  secret_manager_config {
    enabled = true
  }
  ip_allocation_policy {}
}
