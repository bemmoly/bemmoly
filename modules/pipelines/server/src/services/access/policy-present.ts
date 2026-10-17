import type { NamedScope, Policy, PolicyVersion } from '../../../../shared/access.ts';
import type { PolicyRow, PolicyVersionRow } from '../../models/access.ts';
import { iso, isoOrNull } from '../../utils/time.ts';
import { readRequirements } from './facts.ts';

/** A version waiting for a second Platform admin. */
export interface PendingRow {
  policy_id: string;
  version: number;
  sentence: string;
  applies: string;
  requirements: unknown;
  source: string;
  created_by: string | null;
  created_by_name: string | null;
  created_at: Date;
}

/**
 * A policy as the Access screen shows it. A brand-new Tier 0 policy has no version in force
 * yet; it shows its waiting version, marked pending, and is not enforced until approved.
 */
export function presentPolicy(
  row: PolicyRow,
  scope: NamedScope,
  pending: PendingRow | null,
): Policy {
  const live = row.current_version > 0;
  const shown = live || !pending ? row : { ...row, ...pending };
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    scope,
    version: live ? row.current_version : (pending?.version ?? 1),
    enabled: row.enabled && live,
    sentence: shown.sentence,
    applies: shown.applies,
    requirements: readRequirements(shown.requirements),
    source: shown.source,
    sourceRepository: row.source_repository,
    updatedAt: iso(row.updated_at),
    pending: pending
      ? {
          version: pending.version,
          sentence: pending.sentence,
          createdBy: pending.created_by
            ? { id: pending.created_by, name: pending.created_by_name ?? '' }
            : null,
          createdAt: iso(pending.created_at),
        }
      : null,
  };
}

export function presentVersion(row: PolicyVersionRow): PolicyVersion {
  return {
    id: row.id,
    version: row.version,
    applies: row.applies,
    requirements: readRequirements(row.requirements),
    sentence: row.sentence,
    source: row.source,
    createdBy: row.created_by ? { id: row.created_by, name: row.created_by_name ?? '' } : null,
    approvedBy: row.approved_by ? { id: row.approved_by, name: row.approved_by_name ?? '' } : null,
    approvedAt: isoOrNull(row.approved_at),
    createdAt: iso(row.created_at),
  };
}
