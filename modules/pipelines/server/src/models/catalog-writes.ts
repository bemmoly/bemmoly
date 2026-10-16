/*
 * Row shapes the catalog writes and discovery select. Schema only: the tables are defined
 * by the changesets in changelog/.
 */

export interface WritableApplicationRow {
  id: string;
  key: string;
  name: string;
  description: string | null;
  domain_id: string;
  domain_key: string;
  group_id: string;
  group_key: string;
  owner_team_id: string | null;
  owner_team_name: string | null;
  tier: number;
  labels: string[];
  lifecycle: string;
  runtime: string;
  ci_mode: string;
  promotion_mode: string;
  path: string;
  paths: string[];
  source: 'ui' | 'repository';
  file_path: string | null;
  repository_id: string | null;
  repository_full_name: string | null;
  repository_default_branch: string | null;
  depends_on: string[];
  archived_at: Date | null;
}

export interface CatalogChangeRow {
  id: string;
  application_id: string | null;
  application_key: string | null;
  application_name: string | null;
  repository_full_name: string | null;
  kind: 'create' | 'update' | 'archive';
  state: 'pull_request' | 'pending' | 'applied' | 'discarded';
  summary: string;
  changes: Record<string, unknown>;
  pull_request_url: string | null;
  reason: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: Date;
}

export interface ProposalRow {
  id: string;
  repository_id: string;
  repository_full_name: string;
  repository_url: string | null;
  path: string;
  key: string;
  name: string;
  description: string | null;
  signals: string[];
  runtime: string;
  owner_raw: string | null;
  owner_source: 'codeowners' | 'backstage' | null;
  owner_team_id: string | null;
  owner_team_name: string | null;
  group_path: string | null;
  state: 'proposed' | 'accepted' | 'dismissed';
  application_key: string | null;
  created_at: Date;
}
