/* Row shapes of the Bring your CI tables as the CI service selects them. */

export interface CiIssuerRow {
  id: string;
  key: string;
  name: string;
  kind: 'github' | 'gitlab' | 'circleci' | 'buildkite' | 'oidc';
  issuer: string;
  discovery_url: string;
  audience: string | null;
  claim_mapping: Record<string, string>;
  enabled: boolean;
  rule_count?: number;
}

export interface TrustRuleRow {
  id: string;
  issuer_id: string;
  issuer_key: string;
  issuer_name: string;
  repository: string;
  refs: string[];
  workflows: string[];
  environments: string[];
  application_ids: string[];
  enabled: boolean;
  created_at: Date;
}

export interface CiTokenRow {
  id: string;
  name: string;
  token_prefix: string;
  application_ids: string[];
  expires_at: Date | null;
  last_used_at: Date | null;
  revoked_at: Date | null;
  created_at: Date;
}

export interface ExternalCheckRow {
  kind: 'check_run' | 'workflow_run' | 'reported';
  name: string;
  path: string | null;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: string | null;
  url: string | null;
  occurred_at: Date;
}
