/* Row shapes of the Services list, a service's versions and For you as their reads select them. */

export interface PathEnvironmentRecord {
  id: string;
  key: string;
  name: string;
  position: number;
  has_rule: boolean;
  project: string | null;
  region: string | null;
}

export interface ServiceRecord {
  id: string;
  key: string;
  name: string;
  runtime: string;
  path: string;
  repository: string | null;
  domain_key: string;
  domain_name: string;
  domain_color: string;
  team_id: string | null;
  team_name: string | null;
  run_id: string | null;
  run_number: string | number | null;
  run_state: string | null;
  run_created_at: Date | string | null;
}

/** pipeline_current with what built the version and any open change request moving it. */
export interface RunningRecord {
  application_id: string;
  environment_key: string;
  release_id: string | null;
  version: string | null;
  commit_sha: string | null;
  message: string | null;
  state: string;
  moving_version: string | null;
  traffic_percent: number | null;
  deployed_at: Date | string | null;
  deployed_by: string | null;
  change_number: string | number | null;
  change_status: string | null;
  change_approvals: number | null;
  change_needed: number | null;
}

export interface VersionRecord {
  id: string;
  version: string;
  commit_sha: string;
  message: string | null;
  created_at: Date | string;
  created_by: string | null;
  test_summary: { passed?: number; failed?: number } | null;
  run_id: string | null;
  run_number: string | number | null;
  running_in: string[] | null;
  change_number: string | number | null;
  change_status: string | null;
  change_approvals: number | null;
  change_needed: number | null;
}
