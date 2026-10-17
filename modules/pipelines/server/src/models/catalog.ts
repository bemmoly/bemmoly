/*
 * Row shapes of the catalog tables as the services select them. Schema only: the tables
 * themselves are defined by the changesets in changelog/.
 */

export interface DomainRow {
  id: string;
  key: string;
  name: string;
  description: string | null;
  color: string;
  group_count: number;
  application_count: number;
}

export interface GroupRow {
  id: string;
  key: string;
  name: string;
  description: string | null;
  domain_id: string;
  domain_key: string;
  domain_name: string;
  domain_color: string;
  application_count: number;
}

export interface ApplicationRow {
  id: string;
  key: string;
  name: string;
  description: string | null;
  domain_id: string;
  domain_key: string;
  domain_name: string;
  domain_color: string;
  group_id: string;
  group_key: string;
  group_name: string;
  owner_team_id: string | null;
  owner_team_name: string | null;
  tier: number;
  labels: string[];
  runtime: string;
  lifecycle: string;
  ci_mode: string;
  promotion_mode: string;
  health: string;
  repository_id: string | null;
  repository_full_name: string | null;
  repository_url: string | null;
  repository_default_branch: string | null;
  path: string;
  template_ref: string | null;
  last_deployed_at: Date | null;
}

/** Delivery numbers per application, read for one page of rows at a time. */
export interface DeliveryRow {
  application_id: string;
  prod_version: string | null;
  prod_state: string | null;
  prod_deployed_at: Date | null;
  deploys_by_week: number[] | null;
  lead_time_seconds: number | null;
  prod_deploys_30d: number;
  failed_deploys_30d: number;
  last_run_state: string | null;
}

export interface FacetRow {
  facet: string;
  value: string | null;
  label: string | null;
  count: number;
}
