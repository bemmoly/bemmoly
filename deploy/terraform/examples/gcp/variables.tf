variable "project" {
  description = "Google Cloud project id."
  type        = string
}

variable "region" {
  description = "Region for the static address."
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "Zone for the VM, inside region."
  type        = string
  default     = "us-central1-a"
}

variable "name" {
  description = "Name given to the VM, its firewall rules and its address."
  type        = string
  default     = "bemmoly"
}

variable "domain" {
  description = "Hostname people will use, such as bemmoly.example.com."
  type        = string
}

variable "size" {
  description = "small (up to 50 people), medium (up to 200) or large (up to 1,000)."
  type        = string
  default     = "medium"
}

variable "machine_type" {
  description = "Compute Engine machine type. Null picks one from size."
  type        = string
  default     = null
}

variable "bemmoly_version" {
  description = "Release to install, such as 1.2.0, or latest, or beta."
  type        = string
  default     = "latest"
}

variable "channel" {
  description = "Update channel: stable or beta."
  type        = string
  default     = "stable"
}

variable "modules" {
  description = "Module ids to enable, such as [\"work\", \"docs\"]. Empty leaves the choice to the setup wizard."
  type        = list(string)
  default     = []
}

variable "in_app_updates" {
  description = "Run the updater container so admins can update from Settings."
  type        = bool
  default     = true
}

variable "smtp" {
  description = "Outgoing mail, passed to the bemmoly-vm module. Null sets it later in Settings."
  type = object({
    host     = string
    port     = optional(number, 587)
    security = optional(string, "starttls")
    username = optional(string, "")
    password = optional(string, "")
    from     = optional(string, "")
    reply_to = optional(string)
  })
  default   = null
  sensitive = true
}

variable "backups_s3" {
  description = "Off-box backups to an S3-compatible service such as Cloud Storage with HMAC keys, passed to the bemmoly-vm module. Null sets it later in Settings."
  type = object({
    endpoint          = optional(string)
    region            = optional(string, "us-east-1")
    bucket            = string
    prefix            = optional(string, "bemmoly/")
    access_key_id     = string
    secret_access_key = string
    force_path_style  = optional(bool, false)
  })
  default   = null
  sensitive = true
}

variable "ssh_authorized_keys" {
  description = "Public keys added to the default ubuntu user."
  type        = list(string)
  default     = []
}

variable "ssh_source_ranges" {
  description = "IPv4 ranges allowed to reach port 22, such as [\"203.0.113.4/32\"]. Empty keeps SSH closed."
  type        = list(string)
  default     = []
}

variable "network" {
  description = "VPC network for the VM and its firewall rules."
  type        = string
  default     = "default"
}

variable "subnetwork" {
  description = "Subnetwork in zone's region. Null lets the network pick, which suits auto-mode networks such as default."
  type        = string
  default     = null
}

variable "static_ip" {
  description = "Reserve a static address so the DNS record survives a stop and start."
  type        = bool
  default     = true
}

variable "labels" {
  description = "Labels added to the VM and its address."
  type        = map(string)
  default     = {}
}
