variable "region" {
  description = "Where services go when an environment names no region."
  type        = string
}

variable "folder_id" {
  description = "The folder bootstrap.sh made, as digits."
  type        = string
}

variable "billing_account" {
  description = "The billing account that pays for the projects."
  type        = string
}

variable "folders" {
  description = "Each domain folder's ID, as digits."
  type        = map(string)
}

variable "projects" {
  description = "Project IDs, by the name the resources use."
  type        = map(string)
}

variable "project_numbers" {
  description = "Project numbers, which Google names service agents and pools by."
  type        = map(string)
}

variable "pipelines_member" {
  description = "Who Pipelines signs in as, so it may deploy as each deployer."
  type        = string
}
