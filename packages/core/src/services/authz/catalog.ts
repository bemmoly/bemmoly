import { isKernelCapability, type KernelCapability, type SystemRoleKey } from '@bemmoly/shared';
import type { CapabilityDefinition } from '../../modules/registries.ts';
import type { FromModule } from '../../modules/registry.ts';

/** What authz needs from the module registry: enabled ids and declared capabilities. */
export interface ModuleCatalog {
  ids(): string[];
  capabilities(): FromModule<CapabilityDefinition>[];
}

export interface CatalogEntry {
  name: string;
  label: string;
  description: string | null;
  group: string;
  moduleId: string | null;
  defaults: Readonly<Record<SystemRoleKey, boolean>>;
}

type Cells = readonly [boolean, boolean, boolean, boolean, boolean];

const defaults = ([orgAdmin, projectAdmin, member, viewer, contractor]: Cells) => ({
  org_admin: orgAdmin,
  project_admin: projectAdmin,
  member,
  viewer,
  contractor,
});

const ONLY_ORG_ADMIN: Cells = [true, false, false, false, false];

/** Labels, groups and defaults of the Workspace and AI rows in the People mock's matrix. */
const KERNEL: ReadonlyArray<
  readonly [KernelCapability, string, string | null, 'Workspace' | 'AI', Cells]
> = [
  ['workspace.billing.manage', 'Manage billing and license', null, 'Workspace', ONLY_ORG_ADMIN],
  ['workspace.delete', 'Delete workspace', null, 'Workspace', ONLY_ORG_ADMIN],
  ['workspace.sso.configure', 'Configure SSO', null, 'Workspace', ONLY_ORG_ADMIN],
  [
    'workspace.roles.manage',
    'Manage org roles',
    'Create roles, edit this page',
    'Workspace',
    ONLY_ORG_ADMIN,
  ],
  ['workspace.appearance.manage', 'Set appearance and themes', null, 'Workspace', ONLY_ORG_ADMIN],
  [
    'workspace.settings.manage',
    'Manage workspace settings',
    'Read and change settings, set secrets',
    'Workspace',
    ONLY_ORG_ADMIN,
  ],
  [
    'workspace.modules.manage',
    'Manage modules',
    'Enable, disable and remove module data',
    'Workspace',
    ONLY_ORG_ADMIN,
  ],
  [
    'workspace.system.manage',
    'Manage backups and updates',
    'Back up, restore, update and roll back',
    'Workspace',
    ONLY_ORG_ADMIN,
  ],
  [
    'workspace.email.manage',
    'Manage email delivery',
    'SMTP settings, test sends, the dev mailbox',
    'Workspace',
    ONLY_ORG_ADMIN,
  ],
  ['workspace.audit.view', 'View the audit log', null, 'Workspace', ONLY_ORG_ADMIN],
  [
    'ai.assist.use',
    'Use AI assist',
    'Summaries, drafting, search',
    'AI',
    [true, true, true, true, false],
  ],
  [
    'ai.actions.run',
    'Run AI actions that change data',
    'Bulk moves, auto-created issues',
    'AI',
    [true, true, true, false, false],
  ],
  ['ai.models.configure', 'Configure models and data policy', null, 'AI', ONLY_ORG_ADMIN],
];

export const KERNEL_CAPABILITY_CATALOG: readonly CatalogEntry[] = KERNEL.map(
  ([name, label, description, group, cells]) => ({
    name,
    label,
    description,
    group,
    moduleId: null,
    defaults: defaults(cells),
  }),
);

/** Kernel capabilities first, then each enabled module's, in registration order. */
export function capabilityCatalog(modules: ModuleCatalog): CatalogEntry[] {
  return [
    ...KERNEL_CAPABILITY_CATALOG,
    ...modules.capabilities().map((capability) => ({
      name: capability.name,
      label: capability.label,
      description: capability.description ?? null,
      group: capability.group,
      moduleId: capability.moduleId,
      defaults: capability.defaults,
    })),
  ];
}

const KERNEL_AREAS = new Set(['workspace', 'ai']);

/** The module a capability is namespaced under, or null for kernel capabilities. */
export function moduleOfCapability(capability: string): string | null {
  if (isKernelCapability(capability)) return null;
  const prefix = capability.split('.')[0] ?? '';
  return prefix && !KERNEL_AREAS.has(prefix) ? prefix : null;
}
