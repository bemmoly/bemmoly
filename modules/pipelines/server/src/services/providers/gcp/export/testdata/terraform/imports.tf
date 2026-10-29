# Adopts what exists instead of creating it again. After the first apply these blocks do
# nothing, and you may delete them.

import {
  to = google_folder.commerce
  id = "folders/${var.folders.commerce}"
}

import {
  to = google_project.acme_ci_7f3a
  id = var.projects.acme_ci_7f3a
}

import {
  to = google_project.acme_prod_7f3a
  id = var.projects.acme_prod_7f3a
}

import {
  to = google_project_service.acme_ci_7f3a_cloudbuild
  id = "${var.projects.acme_ci_7f3a}/cloudbuild.googleapis.com"
}

import {
  to = google_project_service.acme_ci_7f3a_logging
  id = "${var.projects.acme_ci_7f3a}/logging.googleapis.com"
}

import {
  to = google_project_service.acme_prod_7f3a_run
  id = "${var.projects.acme_prod_7f3a}/run.googleapis.com"
}

import {
  to = google_project_service.acme_prod_7f3a_secretmanager
  id = "${var.projects.acme_prod_7f3a}/secretmanager.googleapis.com"
}

import {
  to = google_compute_network.acme_prod_7f3a_bemmoly
  id = "projects/${var.projects.acme_prod_7f3a}/global/networks/bemmoly"
}

import {
  to = google_logging_project_bucket_config.acme_prod_7f3a_default
  id = "projects/${var.projects.acme_prod_7f3a}/locations/global/buckets/_Default"
}

import {
  to = google_billing_budget.acme_prod_7f3a
  id = "billingAccounts/01A2B3-C4D5E6-F7A8B9/budgets/6f1e2d3c-4b5a-4f6e-8d7c-9b0a1f2e3d4c"
}

import {
  to = google_service_account.acme_prod_7f3a_deployer
  id = "projects/${var.projects.acme_prod_7f3a}/serviceAccounts/deployer@${var.projects.acme_prod_7f3a}.iam.gserviceaccount.com"
}

import {
  to = google_project_iam_member.acme_prod_7f3a_deployer_run_admin
  id = "${var.projects.acme_prod_7f3a} roles/run.admin serviceAccount:deployer@${var.projects.acme_prod_7f3a}.iam.gserviceaccount.com"
}

import {
  to = google_project_iam_member.acme_prod_7f3a_deployer_iam_serviceaccountuser
  id = "${var.projects.acme_prod_7f3a} roles/iam.serviceAccountUser serviceAccount:deployer@${var.projects.acme_prod_7f3a}.iam.gserviceaccount.com"
}

import {
  to = google_project_iam_member.acme_prod_7f3a_deployer_monitoring_viewer
  id = "${var.projects.acme_prod_7f3a} roles/monitoring.viewer serviceAccount:deployer@${var.projects.acme_prod_7f3a}.iam.gserviceaccount.com"
}

import {
  to = google_service_account_iam_member.acme_prod_7f3a_deployer_pipelines
  id = "projects/${var.projects.acme_prod_7f3a}/serviceAccounts/deployer@${var.projects.acme_prod_7f3a}.iam.gserviceaccount.com roles/iam.serviceAccountTokenCreator ${var.pipelines_member}"
}

import {
  to = google_service_account.bemmoly_control_583920174411_builder
  id = "projects/${var.projects.bemmoly_control_583920174411}/serviceAccounts/builder@${var.projects.bemmoly_control_583920174411}.iam.gserviceaccount.com"
}

import {
  to = google_project_iam_member.bemmoly_control_583920174411_builder_logging_logwriter
  id = "${var.projects.bemmoly_control_583920174411} roles/logging.logWriter serviceAccount:builder@${var.projects.bemmoly_control_583920174411}.iam.gserviceaccount.com"
}

import {
  to = google_project_iam_member.bemmoly_control_583920174411_builder_artifactregistry_writer
  id = "${var.projects.bemmoly_control_583920174411} roles/artifactregistry.writer serviceAccount:builder@${var.projects.bemmoly_control_583920174411}.iam.gserviceaccount.com"
}

import {
  to = google_service_account.acme_prod_7f3a_runtime
  id = "projects/${var.projects.acme_prod_7f3a}/serviceAccounts/runtime@${var.projects.acme_prod_7f3a}.iam.gserviceaccount.com"
}

import {
  to = google_project_iam_member.acme_prod_7f3a_runtime_logging_logwriter
  id = "${var.projects.acme_prod_7f3a} roles/logging.logWriter serviceAccount:runtime@${var.projects.acme_prod_7f3a}.iam.gserviceaccount.com"
}

import {
  to = google_project_iam_member.acme_prod_7f3a_runtime_monitoring_metricwriter
  id = "${var.projects.acme_prod_7f3a} roles/monitoring.metricWriter serviceAccount:runtime@${var.projects.acme_prod_7f3a}.iam.gserviceaccount.com"
}

import {
  to = google_project_iam_member.acme_prod_7f3a_runtime_cloudtrace_agent
  id = "${var.projects.acme_prod_7f3a} roles/cloudtrace.agent serviceAccount:runtime@${var.projects.acme_prod_7f3a}.iam.gserviceaccount.com"
}

import {
  to = google_artifact_registry_repository.apps
  id = "projects/${var.projects.bemmoly_control_583920174411}/locations/us-central1/repositories/apps"
}

import {
  to = google_artifact_registry_repository_iam_member.bemmoly_control_583920174411_builder_push
  id = "projects/${var.projects.bemmoly_control_583920174411}/locations/us-central1/repositories/apps roles/artifactregistry.writer serviceAccount:builder@${var.projects.bemmoly_control_583920174411}.iam.gserviceaccount.com"
}

import {
  to = google_artifact_registry_repository_iam_member.acme_prod_7f3a_run_agent_pull
  id = "projects/${var.projects.bemmoly_control_583920174411}/locations/us-central1/repositories/apps roles/artifactregistry.reader serviceAccount:service-${var.project_numbers.acme_prod_7f3a}@serverless-robot-prod.iam.gserviceaccount.com"
}

import {
  to = google_artifact_registry_repository_iam_member.acme_prod_7f3a_runtime_pull
  id = "projects/${var.projects.bemmoly_control_583920174411}/locations/us-central1/repositories/apps roles/artifactregistry.reader serviceAccount:runtime@${var.projects.acme_prod_7f3a}.iam.gserviceaccount.com"
}

import {
  to = google_project_iam_member.acme_prod_7f3a_runtime_secrets
  id = "${var.projects.acme_prod_7f3a} roles/secretmanager.secretAccessor serviceAccount:runtime@${var.projects.acme_prod_7f3a}.iam.gserviceaccount.com"
}

import {
  to = google_secret_manager_secret.bemmoly_checkout_api_db_url_prod
  id = "projects/${var.projects.acme_prod_7f3a}/secrets/bemmoly-checkout-api-DB_URL-prod"
}

import {
  to = google_secret_manager_secret.bemmoly_payments_worker_stripe_key_prod
  id = "projects/${var.projects.acme_prod_7f3a}/secrets/bemmoly-payments-worker-STRIPE_KEY-prod"
}

import {
  to = google_cloud_run_v2_service.checkout_api_prod
  id = "projects/${var.projects.acme_prod_7f3a}/locations/us-central1/services/checkout-api"
}

import {
  to = google_cloud_run_v2_service_iam_member.checkout_api_prod_public
  id = "projects/${var.projects.acme_prod_7f3a}/locations/us-central1/services/checkout-api roles/run.invoker allUsers"
}

import {
  to = google_secret_manager_secret_iam_member.bemmoly_checkout_api_db_url_prod_runtime
  id = "projects/${var.projects.acme_prod_7f3a}/secrets/bemmoly-checkout-api-DB_URL-prod roles/secretmanager.secretAccessor serviceAccount:runtime@${var.projects.acme_prod_7f3a}.iam.gserviceaccount.com"
}

import {
  to = google_secret_manager_secret_iam_member.bemmoly_payments_worker_stripe_key_prod_checkout_payments_worker
  id = "projects/${var.projects.acme_prod_7f3a}/secrets/bemmoly-payments-worker-STRIPE_KEY-prod roles/secretmanager.secretAccessor principal://iam.googleapis.com/projects/${var.project_numbers.acme_prod_7f3a}/locations/global/workloadIdentityPools/acme-prod-7f3a.svc.id.goog/subject/ns/checkout/sa/payments-worker"
}

import {
  to = google_container_cluster.bemmoly_prod
  id = "projects/${var.projects.acme_prod_7f3a}/locations/us-central1/clusters/bemmoly-prod"
}
