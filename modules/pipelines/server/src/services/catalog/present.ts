import type {
  Application,
  DeliverySummary,
  Domain,
  DomainColor,
  Group,
} from '../../../../shared/catalog.ts';
import type {
  CiMode,
  Health,
  Lifecycle,
  PromotionMode,
  Runtime,
  Tier,
} from '../../../../shared/common.ts';
import type { ApplicationRow, DomainRow, GroupRow } from '../../models/catalog.ts';
import { isoOrNull } from '../../utils/time.ts';
import { EMPTY_DELIVERY } from './delivery.ts';

/* Rows into the contracts' shapes; the CHECK constraints guarantee the enum casts. */

export const toDomain = (row: DomainRow): Domain => ({
  id: row.id,
  key: row.key,
  name: row.name,
  description: row.description,
  color: row.color as DomainColor,
  groupCount: row.group_count,
  applicationCount: row.application_count,
});

export const toGroup = (row: GroupRow): Group => ({
  id: row.id,
  key: row.key,
  name: row.name,
  description: row.description,
  domain: {
    id: row.domain_id,
    key: row.domain_key,
    name: row.domain_name,
    color: row.domain_color as DomainColor,
  },
  applicationCount: row.application_count,
});

export function toApplication(row: ApplicationRow, delivery?: DeliverySummary): Application {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    domain: {
      id: row.domain_id,
      key: row.domain_key,
      name: row.domain_name,
      color: row.domain_color as DomainColor,
    },
    group: { id: row.group_id, key: row.group_key, name: row.group_name },
    ownerTeam:
      row.owner_team_id && row.owner_team_name
        ? { id: row.owner_team_id, name: row.owner_team_name }
        : null,
    tier: row.tier as Tier,
    labels: row.labels,
    runtime: row.runtime as Runtime,
    lifecycle: row.lifecycle as Lifecycle,
    ciMode: row.ci_mode as CiMode,
    promotionMode: row.promotion_mode as PromotionMode,
    health: row.health as Health,
    repository:
      row.repository_id && row.repository_full_name
        ? {
            id: row.repository_id,
            fullName: row.repository_full_name,
            url: row.repository_url,
            defaultBranch: row.repository_default_branch ?? 'main',
          }
        : null,
    path: row.path,
    templateRef: row.template_ref,
    lastDeployedAt: isoOrNull(row.last_deployed_at),
    delivery: delivery ?? EMPTY_DELIVERY,
  };
}

/** The columns toApplication reads, over CATALOG_FROM's aliases. */
export const APPLICATION_COLUMNS = `
  a.id, a.key, a.name, a.description,
  d.id as domain_id, d.key as domain_key, d.name as domain_name, d.color as domain_color,
  g.id as group_id, g.key as group_key, g.name as group_name,
  a.owner_team_id, t.name as owner_team_name,
  a.tier, a.labels, a.runtime, a.lifecycle, a.ci_mode, a.promotion_mode, a.health,
  a.repository_id, r.full_name as repository_full_name, r.url as repository_url,
  r.default_branch as repository_default_branch,
  a.path, a.template_ref, a.last_deployed_at`;
