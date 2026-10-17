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

export const toConnection = (row: ConnectionRow): CloudConnection => ({
  id: row.id,
  provider: row.provider as Provider,
  name: row.name,
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
