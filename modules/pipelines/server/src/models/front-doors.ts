/* Row shapes of front doors, their routes and runtime moves as the services select them. */

export interface StoredBackend {
  runtime: string;
  revision: string | null;
  percent: number;
}

export interface FrontDoorRow {
  id: string;
  environment_id: string;
  environment_key: string;
  environment_name: string;
  environment_class: string;
  enabled: boolean;
  domain: string | null;
  status: string;
  addresses: Record<string, string>;
  problems: string[];
  applied_at: Date | null;
}

export interface FrontDoorRouteRow {
  id: string;
  front_door_id: string;
  application_id: string;
  application_key: string;
  application_name: string;
  account: string;
  host: string;
  backends: StoredBackend[];
}

export interface RuntimeMoveRow {
  id: string;
  application_id: string;
  environment_id: string;
  release_id: string | null;
  from_runtime: string;
  to_runtime: string;
  follows_default: boolean;
  state: string;
  paused_state: string | null;
  steps: number[];
  step_index: number;
  traffic_percent: number;
  hold_minutes: number;
  sample_seconds: number;
  from_revision: string | null;
  to_revision: string | null;
  failing_samples: number;
  waited_samples: number;
  message: string | null;
  step_started_at: Date | null;
  next_action_at: Date | null;
  busy_until: Date | null;
  requested_by: string | null;
  started_by: string | null;
  finished_at: Date | null;
  created_at: Date;
  updated_at: Date;
}
