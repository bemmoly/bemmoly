import type {
  CloudAccount,
  CloudConnection,
  CloudResource,
  LandingZoneNode,
  LandingZonePlan,
  Layout,
} from '../../../../shared/clouds.ts';
import type { DomainColor } from '../../../../shared/catalog.ts';
import type { EnvironmentClass, Provider } from '../../../../shared/common.ts';
import type { AccountRow, ConnectionRow, PlanRow, ResourceRow } from '../../models/clouds.ts';
import { iso, isoOrNull } from '../../utils/time.ts';

/* Rows as the Platform › Clouds contracts describe them. */

/** The folder's display name, not its id: "folders/417302018845" means nothing on screen. */
const boundaryOf = (row: ConnectionRow) =>
  row.boundary_ref
    ? String(row.config['folderName'] ?? row.config['organizationalUnitName'] ?? row.boundary_ref)
    : null;

const textOf = (value: unknown) => (typeof value === 'string' && value ? value : null);

/** Connections made before attached mode existed are all managed ones. */
const modeOf = (row: ConnectionRow): CloudConnection['mode'] =>
  row.config['mode'] === 'attached' ? 'attached' : 'managed';

const SIGN_INS = { metadata: 'vm', application_default: 'application_default' } as const;

function signInOf(row: ConnectionRow): CloudConnection['signIn'] {
  if (row.provider !== 'gcp') return null;
  const kind = (row.config['credentials'] as { kind?: string } | undefined)?.kind ?? 'metadata';
  return kind in SIGN_INS ? SIGN_INS[kind as keyof typeof SIGN_INS] : 'workload_identity_file';
}

export const toConnection = (row: ConnectionRow): CloudConnection => ({
  id: row.id,
  provider: row.provider as Provider,
  name: row.name,
  mode: modeOf(row),
  signIn: signInOf(row),
  region: textOf(row.config['region']),
  registry: textOf(row.config['registry']),
  ciAccountId: textOf(row.config['ciAccountId']),
  status: row.status as CloudConnection['status'],
  principal: row.principal,
  boundary: boundaryOf(row),
  layout: row.layout as Layout,
  lastCheckedAt: isoOrNull(row.last_checked_at),
  lastError: row.last_error,
  createdAt: iso(row.created_at),
});

export const toAccount = (row: AccountRow): CloudAccount => ({
  id: row.id,
  connectionId: row.connection_id,
  externalId: row.external_id,
  name: row.name,
  domain:
    row.domain_id && row.domain_key && row.domain_name
      ? {
          id: row.domain_id,
          key: row.domain_key,
          name: row.domain_name,
          color: (row.domain_color ?? 'epic-1') as DomainColor,
        }
      : null,
  environmentClass: row.environment_class as EnvironmentClass | null,
  purpose: row.purpose as CloudAccount['purpose'],
  status: row.status as CloudAccount['status'],
  origin: row.origin === 'attached' ? 'attached' : 'created',
  deployerServiceAccount: textOf(row.config['deployerServiceAccount']),
  runtimeServiceAccount: textOf(row.config['runtimeServiceAccount']),
  problems: Array.isArray(row.problems) ? row.problems.map(String) : [],
  lastCheckedAt: isoOrNull(row.last_checked_at),
});

export const toResource = (row: ResourceRow): CloudResource => ({
  id: row.id,
  accountId: row.account_id,
  kind: row.kind as CloudResource['kind'],
  name: row.name,
  desired: row.desired,
  observed: row.observed,
  status: row.status as CloudResource['status'],
  lastReconciledAt: isoOrNull(row.last_reconciled_at),
  lastError: row.last_error,
});

export const toPlan = (row: PlanRow): LandingZonePlan => ({
  planId: row.id,
  connectionId: row.connection_id,
  layout: row.layout as Layout,
  root: row.tree as LandingZoneNode,
  counts: row.counts,
  blockers: row.blockers,
  specHash: row.spec_hash,
});
