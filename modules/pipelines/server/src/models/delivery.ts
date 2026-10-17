/* Row shapes of the map, For you and the environment strip as their services select them. */

export interface MapRowRecord {
  id: string;
  key: string;
  name: string;
  color: string | null;
  count: number;
}

export interface MapCellRecord {
  row_id: string;
  environment_id: string;
  total: number;
  moving: number;
  failed: number;
  waiting: number;
  canary: number;
  rolled_back: number;
}

export interface MapDotRecord {
  row_id: string;
  environment_id: string;
  id: string;
  application: string;
  version: string | null;
  state: string;
  progress: number;
}

export interface BuildCellRecord {
  row_id: string;
  running: number;
}

export interface BuildDotRecord {
  row_id: string;
  id: string;
  application: string;
  version: string;
  progress: number;
}

export interface MapEnvironmentRecord {
  id: string;
  key: string;
  name: string;
  class: string;
  protection: Record<string, unknown>;
}

export interface TimelineRecord {
  start: Date | string;
  deploys: number;
  incident: boolean;
}

export interface StripRecord {
  environment_id: string;
  environment_key: string;
  environment_name: string;
  environment_class: string;
  region: string | null;
  protection: Record<string, unknown>;
  release_id: string | null;
  version: string | null;
  commit_sha: string | null;
  state: string | null;
  traffic_percent: number | null;
  moving_release_id: string | null;
  moving_version: string | null;
  deployment_id: string | null;
  deployed_at: Date | string | null;
  previous_version: string | null;
}
