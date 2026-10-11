output "user_data" {
  description = "Cloud-config for the VM's first boot: installs Bemmoly and imports any SMTP and backup settings."
  value       = "#cloud-config\n${yamlencode(local.cloud_config)}"
  # Sensitive whenever SMTP or S3 credentials are given, and plans should not print it either way.
  sensitive = true
}

output "sizing" {
  description = "Recommended vcpu, memory_gb and disk_gb for the chosen size."
  value       = local.sizes[var.size]
}

output "public_url" {
  description = "Where Bemmoly answers once DNS points at the VM."
  value       = "https://${var.domain}"
}
