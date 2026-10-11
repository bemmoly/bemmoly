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

output "instance_type" {
  description = "The EC2 instance type in use."
  value       = local.instance_type
}

output "instance_id" {
  description = "The EC2 instance id."
  value       = aws_instance.bemmoly.id
}
