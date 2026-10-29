/* Row shapes of clusters and runtime choices as the services select them. */

export interface ClusterRow {
  id: string;
  connection_id: string;
  connection_name: string;
  connection_provider: string;
  connection_layout: string;
  connection_boundary_ref: string | null;
  connection_config: Record<string, unknown>;
  environment_id: string;
  environment_key: string;
  environment_name: string;
  environment_class: string;
  origin: string;
  mode: string;
  project_id: string;
  location: string;
  name: string;
  status: string;
  release_channel: string | null;
  gateway: { namespace: string; name: string } | null;
  problems: string[];
  last_checked_at: Date | null;
  created_at: Date;
  /** The environment's own project, for who deploys into a cluster that lives there. */
  account_external_id: string | null;
  account_config: Record<string, unknown> | null;
}

export interface RuntimeRow {
  environment_id: string;
  environment_key: string;
  environment_name: string;
  environment_class: string;
  provider: string;
  default_runtime: string;
  chosen: string | null;
  file: string | null;
  cluster_id: string | null;
  cluster_name: string | null;
  cluster_mode: string | null;
  cluster_origin: string | null;
  cluster_status: string | null;
}
