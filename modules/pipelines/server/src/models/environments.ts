/* Row shapes of environments and their paths as the services select them. */

export interface EnvironmentRow {
  id: string;
  key: string;
  name: string;
  class: string;
  provider: string;
  region: string | null;
  position: number;
  protection: Record<string, unknown>;
  account_id: string | null;
  account_external_id: string | null;
  account_name: string | null;
}

export interface PathStepRow {
  path_id: string;
  tier: number;
  path_name: string;
  environment_id: string;
  environment_key: string;
  environment_name: string;
  environment_class: string;
  stage: number;
  bake_minutes: number;
  auto_promote: boolean;
}

export interface TeamRow {
  id: string;
  name: string;
  member_count: number;
  application_count: number;
  mine: boolean;
}
