/*
 * Row shapes of the release, promotion and deployment tables as the shipping services
 * select them. Schema only: the tables are defined by the changesets in changelog/. The
 * kernel client hands timestamps back as text, so they are typed as strings here.
 */

export interface ReleaseRow {
  id: string;
  application_id: string;
  version: string;
  source: string;
  run_id: string | null;
  run_number: number | null;
  run_state: string | null;
  run_author_id: string | null;
  commit_sha: string;
  ref: string | null;
  image_repository: string | null;
  image_digests: Record<string, string>;
  resolved_config: Record<string, unknown>;
  test_summary: { total: number; passed: number; failed: number; skipped: number } | null;
  provenance: Record<string, unknown> | null;
  sbom_object_key: string | null;
  notes: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
}

/** An application with what shipping needs: tier, owner and where it sits in the tree. */
export interface ShippingApplicationRow {
  id: string;
  key: string;
  name: string;
  tier: number;
  runtime: string;
  domain_id: string;
  domain_key: string;
  group_id: string;
  group_key: string;
  owner_team_id: string | null;
  health: string;
}

export interface ShippingEnvironmentRow {
  id: string;
  key: string;
  name: string;
  class: string;
  provider: string;
  region: string | null;
  position: number;
  protection: Record<string, unknown>;
  cloud_account_id: string | null;
}

export interface PromotionRow {
  id: string;
  release_id: string;
  application_id: string;
  environment_id: string;
  mode: string;
  departure_id: string | null;
  coordination_id: string | null;
  coordination_order: number | null;
  state: string;
  plan: unknown;
  policy_versions: string[];
  requested_by: string | null;
  release_digest: string | null;
  next_check_at: string | null;
  current_wave: number;
  failure_policy: string;
  freeze_override: { by: string; reason: string; at: string } | null;
  note: string | null;
  outcome_reason: string | null;
  approved_at: string | null;
  started_at: string | null;
  expires_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface DeploymentRow {
  id: string;
  promotion_id: string | null;
  release_id: string;
  application_id: string;
  environment_id: string;
  kind: string;
  wave: number;
  state: string;
  traffic_percent: number;
  revision: string | null;
  previous_release_id: string | null;
  previous_revision: string | null;
  rollback_of_id: string | null;
  phase: string;
  plan: unknown;
  step_index: number;
  step_started_at: string | null;
  next_action_at: string | null;
  failing_samples: number;
  pause_reason: string | null;
  reason: string | null;
  started_by: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface GateResultRow {
  gate: string;
  state: string;
  reason: string;
  evidence: Record<string, unknown>;
  recheck_at: string | null;
  evaluated_at: string;
}

export interface ApprovalRow {
  id: string;
  promotion_id: string;
  user_id: string;
  user_name: string;
  requirement: string;
  decision: string;
  release_digest: string;
  comment: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface CurrentRow {
  application_id: string;
  application_key: string;
  application_name: string;
  tier: number;
  environment_id: string;
  environment_key: string;
  environment_name: string;
  environment_class: string;
  release_id: string | null;
  version: string | null;
  state: string;
  moving_release_id: string | null;
  moving_version: string | null;
  traffic_percent: number;
  deployment_id: string | null;
  deployed_at: string | null;
}
