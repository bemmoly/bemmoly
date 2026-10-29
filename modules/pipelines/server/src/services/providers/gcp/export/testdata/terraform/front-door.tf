# The front door: one load balancer per service, so a move between Cloud Run and GKE is a
# weighted traffic change. Pipelines does not make one yet. When it does, its addresses,
# backends and certificates are exported in this file.
