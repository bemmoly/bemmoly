/*
 * Row shapes of the access tables as the access service selects them. Schema only: the
 * tables are defined by the changesets in changelog/.
 */

export interface TargetRow {
  id: string;
  key: string;
  name: string;
  tier: number;
  labels: string[];
  lifecycle: string;
  runtime: string;
  domain_id: string;
  domain_key: string;
  domain_name: string;
  group_id: string;
  group_key: string;
  group_name: string;
  owner_id: string | null;
  owner_name: string | null;
}

export interface ScopeRow {
  domain_id: string;
  domain_key: string;
  domain_name: string;
  group_id: string | null;
  group_key: string | null;
  group_name: string | null;
}

export interface EnvironmentFactRow {
  id: string;
  key: string;
  name: string;
  class: string;
  region: string | null;
  protection: { protected?: boolean; window?: string | null } | null;
}

export interface BindingRow {
  id: string;
  subject_kind: 'team' | 'user';
  subject_id: string;
  subject_name: string | null;
  subject_avatar: string | null;
  role: string;
  scope_kind: string;
  scope_id: string | null;
  scope_key: string | null;
  scope_name: string | null;
  environment_class: string | null;
  expires_at: Date | null;
  reason: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: Date;
}

export interface PolicyRow {
  id: string;
  key: string;
  name: string;
  scope_kind: string;
  scope_id: string | null;
  scope_name: string | null;
  current_version: number;
  enabled: boolean;
  source_repository: string | null;
  updated_at: Date;
  applies: string;
  requirements: unknown;
  sentence: string;
  source: string;
}

export interface PolicyVersionRow {
  id: string;
  policy_id: string;
  version: number;
  applies: string;
  requirements: unknown;
  sentence: string;
  source: string;
  created_by: string | null;
  created_by_name: string | null;
  approved_by: string | null;
  approved_by_name: string | null;
  approved_at: Date | null;
  created_at: Date;
}

export interface FreezeRow {
  id: string;
  name: string;
  starts_at: Date;
  ends_at: Date;
  environment_class: string | null;
}
