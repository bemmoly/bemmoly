# The folders, projects, APIs, networks, log retention and budgets Pipelines made.

# The Commerce domain's folder.
resource "google_folder" "commerce" {
  display_name = "Commerce"
  parent       = "folders/${var.folder_id}"
}

resource "google_project" "acme_ci_7f3a" {
  project_id      = var.projects.acme_ci_7f3a
  name            = "Bemmoly CI"
  folder_id       = var.folder_id
  billing_account = var.billing_account
  labels = {
    managed-by = "bemmoly"
    purpose    = "ci"
  }
}

resource "google_project" "acme_prod_7f3a" {
  project_id      = var.projects.acme_prod_7f3a
  name            = "Prod"
  folder_id       = google_folder.commerce.folder_id
  billing_account = var.billing_account
  labels = {
    environment = "prod"
    managed-by  = "bemmoly"
  }
}

resource "google_project_service" "acme_ci_7f3a_cloudbuild" {
  project = google_project.acme_ci_7f3a.project_id
  service = "cloudbuild.googleapis.com"
}

resource "google_project_service" "acme_ci_7f3a_logging" {
  project = google_project.acme_ci_7f3a.project_id
  service = "logging.googleapis.com"
}

resource "google_project_service" "acme_prod_7f3a_run" {
  project = google_project.acme_prod_7f3a.project_id
  service = "run.googleapis.com"
}

resource "google_project_service" "acme_prod_7f3a_secretmanager" {
  project = google_project.acme_prod_7f3a.project_id
  service = "secretmanager.googleapis.com"
}

resource "google_compute_network" "acme_prod_7f3a_bemmoly" {
  project                 = google_project.acme_prod_7f3a.project_id
  name                    = "bemmoly"
  auto_create_subnetworks = true
}

# How long the project keeps its logs; the _Default bucket always exists.
resource "google_logging_project_bucket_config" "acme_prod_7f3a_default" {
  project        = google_project.acme_prod_7f3a.project_id
  location       = "global"
  bucket_id      = "_Default"
  retention_days = 30
}

resource "google_billing_budget" "acme_prod_7f3a" {
  billing_account = var.billing_account
  display_name    = "Bemmoly acme-prod-7f3a"
  budget_filter {
    projects = ["projects/${var.project_numbers.acme_prod_7f3a}"]
  }
  amount {
    specified_amount {
      currency_code = "USD"
      units         = "500"
    }
  }
  threshold_rules {
    threshold_percent = 0.5
  }
  threshold_rules {
    threshold_percent = 0.9
  }
  threshold_rules {
    threshold_percent = 1
  }
}
