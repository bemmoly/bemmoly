# Service accounts and the roles Pipelines granted them.

resource "google_service_account" "acme_prod_7f3a_deployer" {
  project      = google_project.acme_prod_7f3a.project_id
  account_id   = "deployer"
  display_name = "Bemmoly deployer"
  description  = "Managed by Bemmoly Pipelines; changes are reverted by the landing zone"
}

resource "google_project_iam_member" "acme_prod_7f3a_deployer_run_admin" {
  project = google_project.acme_prod_7f3a.project_id
  role    = "roles/run.admin"
  member  = google_service_account.acme_prod_7f3a_deployer.member
}

resource "google_project_iam_member" "acme_prod_7f3a_deployer_iam_serviceaccountuser" {
  project = google_project.acme_prod_7f3a.project_id
  role    = "roles/iam.serviceAccountUser"
  member  = google_service_account.acme_prod_7f3a_deployer.member
}

resource "google_project_iam_member" "acme_prod_7f3a_deployer_monitoring_viewer" {
  project = google_project.acme_prod_7f3a.project_id
  role    = "roles/monitoring.viewer"
  member  = google_service_account.acme_prod_7f3a_deployer.member
}

# Lets Pipelines deploy as this account. Remove it once Pipelines no longer deploys here.
resource "google_service_account_iam_member" "acme_prod_7f3a_deployer_pipelines" {
  service_account_id = google_service_account.acme_prod_7f3a_deployer.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = var.pipelines_member
}

resource "google_service_account" "bemmoly_control_583920174411_builder" {
  project      = var.projects.bemmoly_control_583920174411
  account_id   = "builder"
  display_name = "Bemmoly builder"
  description  = "Managed by Bemmoly Pipelines; changes are reverted by the landing zone"
}

resource "google_project_iam_member" "bemmoly_control_583920174411_builder_logging_logwriter" {
  project = var.projects.bemmoly_control_583920174411
  role    = "roles/logging.logWriter"
  member  = google_service_account.bemmoly_control_583920174411_builder.member
}

resource "google_project_iam_member" "bemmoly_control_583920174411_builder_artifactregistry_writer" {
  project = var.projects.bemmoly_control_583920174411
  role    = "roles/artifactregistry.writer"
  member  = google_service_account.bemmoly_control_583920174411_builder.member
}

resource "google_service_account" "acme_prod_7f3a_runtime" {
  project      = google_project.acme_prod_7f3a.project_id
  account_id   = "runtime"
  display_name = "Bemmoly runtime"
  description  = "Managed by Bemmoly Pipelines; changes are reverted by the landing zone"
}

resource "google_project_iam_member" "acme_prod_7f3a_runtime_logging_logwriter" {
  project = google_project.acme_prod_7f3a.project_id
  role    = "roles/logging.logWriter"
  member  = google_service_account.acme_prod_7f3a_runtime.member
}

resource "google_project_iam_member" "acme_prod_7f3a_runtime_monitoring_metricwriter" {
  project = google_project.acme_prod_7f3a.project_id
  role    = "roles/monitoring.metricWriter"
  member  = google_service_account.acme_prod_7f3a_runtime.member
}

resource "google_project_iam_member" "acme_prod_7f3a_runtime_cloudtrace_agent" {
  project = google_project.acme_prod_7f3a.project_id
  role    = "roles/cloudtrace.agent"
  member  = google_service_account.acme_prod_7f3a_runtime.member
}

resource "google_project_iam_member" "acme_prod_7f3a_runtime_secrets" {
  project = google_project.acme_prod_7f3a.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:runtime@${var.projects.acme_prod_7f3a}.iam.gserviceaccount.com"
}
