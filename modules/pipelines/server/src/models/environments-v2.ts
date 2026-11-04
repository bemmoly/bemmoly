/* Row shapes of equal environments as the environments-v2 service selects them. */

export interface EnvironmentV2Row {
  id: string;
  key: string;
  name: string;
  position: number;
  provider: string;
  region: string | null;
  cloud_account_id: string | null;
  account_external_id: string | null;
  account_name: string | null;
  deployers: unknown;
  approval_rule: unknown;
  deploy_window: unknown;
  versions_allowed: string;
  service_count: number;
}

export interface ApprovalGroupNameRow {
  id: string;
  name: string;
}
