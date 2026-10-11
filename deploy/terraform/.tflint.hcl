# The bundled Terraform ruleset only: the cloud rulesets are separate plugin downloads, and
# terraform validate plus the mocked tests already catch most of what they would.
config {
  call_module_type = "local"
}

plugin "terraform" {
  enabled = true
  preset  = "recommended"
}
