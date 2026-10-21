import type { CapabilityDefinition, SystemRole } from '@bemmoly/core';
import { WORK_ACTIONS, type ActionCells } from '../../../shared/actions.ts';

const defaults = ([orgAdmin, projectAdmin, member, viewer, contractor]: ActionCells) =>
  ({
    org_admin: orgAdmin,
    project_admin: projectAdmin,
    member,
    viewer,
    contractor,
  }) satisfies Readonly<Record<SystemRole, boolean>>;

/**
 * The Work rows of the roles matrix: the action catalog, one capability per action, all in
 * the "Projects" group of the People mock. Org locks are rows an org admin sets; no Work row
 * is locked by default.
 */
export const WORK_CAPABILITIES: readonly CapabilityDefinition[] = WORK_ACTIONS.map(
  ({ name, label, description, defaults: cells }) => ({
    name: name as CapabilityDefinition['name'],
    label,
    ...(description ? { description } : {}),
    group: 'Projects',
    defaults: defaults(cells),
  }),
);
