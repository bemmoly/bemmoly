/* Row shapes of cloud connections, accounts, resources and landing zone plans. */

export interface ConnectionRow {
  id: string;
  provider: string;
  name: string;
  status: string;
  principal: string | null;
  boundary_ref: string | null;
  layout: string;
  config: Record<string, unknown>;
  last_checked_at: Date | null;
  last_error: string | null;
  created_at: Date;
}

export interface AccountRow {
  id: string;
  connection_id: string;
  external_id: string;
  name: string;
  purpose: string;
  status: string;
  environment_class: string | null;
  domain_id: string | null;
  domain_key: string | null;
  domain_name: string | null;
  domain_color: string | null;
}

export interface ResourceRow {
  id: string;
  account_id: string;
  account_external_id: string;
  kind: string;
  name: string;
  desired: Record<string, unknown>;
  observed: Record<string, unknown> | null;
  spec_hash: string | null;
  status: string;
  last_reconciled_at: Date | null;
  last_error: string | null;
}

export interface PlanRow {
  id: string;
  connection_id: string;
  layout: string;
  spec_hash: string;
  desired: unknown;
  tree: unknown;
  counts: { folders: number; accounts: number; resources: number };
  blockers: string[];
  status: string;
  attempts: number;
  created_at: Date;
}

export interface ZoneEnvironmentRow {
  id: string;
  key: string;
  name: string;
  class: string;
}

export interface ZoneGroupRow {
  id: string;
  key: string;
  name: string;
  domain_id: string;
}
