output "public_ip" {
  description = "The server's public IPv4 address."
  value       = hcloud_server.bemmoly.ipv4_address
}

output "public_ipv6" {
  description = "The server's public IPv6 address."
  value       = hcloud_server.bemmoly.ipv6_address
}

output "url" {
  description = "Where Bemmoly answers once the DNS records exist."
  value       = module.bemmoly.public_url
}

output "dns_records" {
  description = "The records to create at your DNS provider; the AAAA record is optional."
  value = [
    { type = "A", name = var.domain, value = hcloud_server.bemmoly.ipv4_address },
    { type = "AAAA", name = var.domain, value = hcloud_server.bemmoly.ipv6_address },
  ]
}

output "server_type" {
  description = "The Hetzner server type in use."
  value       = local.server_type
}
