variable "location" {
  description = "Hetzner location, such as nbg1, fsn1, hel1, ash or hil."
  type        = string
  default     = "nbg1"
}

variable "name" {
  description = "Name given to the server and its firewall."
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

variable "server_type" {
  description = "Hetzner server type. Null picks one from size."
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
  description = "Off-box backups to an S3-compatible service such as Hetzner Object Storage, passed to the bemmoly-vm module. Null sets it later in Settings."
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
  description = "Public keys cloud-init adds to the image's default user."
  type        = list(string)
  default     = []
}

variable "ssh_keys" {
  description = "Names or ids of SSH keys already in the Hetzner project. Empty adds none, and Hetzner then emails a root password."
  type        = list(string)
  default     = []
}

variable "ssh_source_ips" {
  description = "Ranges allowed to reach port 22, such as [\"203.0.113.4/32\"]. Empty keeps SSH closed."
  type        = list(string)
  default     = []
}

variable "labels" {
  description = "Labels added to the server and its firewall."
  type        = map(string)
  default     = {}
}
