output "public_ip" {
  description = "The VM's public IPv4 address."
  value       = local.public_ip
}

output "url" {
  description = "Where Bemmoly answers once the DNS record exists."
  value       = module.bemmoly.public_url
}

output "dns_record" {
  description = "The record to create at your DNS provider."
  value = {
    type  = "A"
    name  = var.domain
    value = local.public_ip
  }
}

output "machine_type" {
  description = "The Compute Engine machine type in use."
  value       = local.machine_type
}

output "instance_name" {
  description = "For gcloud compute ssh and the console."
  value       = google_compute_instance.bemmoly.name
}
