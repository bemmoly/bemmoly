variable "region" {
  description = "AWS region for the VM."
  type        = string
  default     = "us-east-1"
}

variable "name" {
  description = "Name given to the instance, its security group and its address."
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

variable "instance_type" {
  description = "EC2 instance type. Null picks one from size."
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
  description = "Off-box backups to S3, passed to the bemmoly-vm module. Null sets it later in Settings."
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

variable "key_name" {
  description = "Existing EC2 key pair for SSH. Null adds none; ssh_authorized_keys also grants access."
  type        = string
  default     = null
}

variable "ssh_authorized_keys" {
  description = "Public keys added to the default ubuntu user."
  type        = list(string)
  default     = []
}

variable "ssh_cidr_blocks" {
  description = "IPv4 ranges allowed to reach port 22, such as [\"203.0.113.4/32\"]. Empty keeps SSH closed."
  type        = list(string)
  default     = []
}

variable "vpc_id" {
  description = "VPC for the security group. Null uses the region's default VPC."
  type        = string
  default     = null
}

variable "subnet_id" {
  description = "Public subnet for the instance, inside vpc_id. Null uses a default subnet."
  type        = string
  default     = null
}

variable "elastic_ip" {
  description = "Attach an Elastic IP so the address, and so the DNS record, survives a stop and start."
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags added to every resource."
  type        = map(string)
  default     = {}
}
