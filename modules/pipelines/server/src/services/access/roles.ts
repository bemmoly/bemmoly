import type { AccessAction, Role } from '../../../../shared/access.ts';

/*
 * What each role may do (product design, "Who can do what"). Protected environments (Prod)
 * narrow deploy, roll back and changing variables to the roles trusted with them; everyone
 * else reaches Prod by requesting a promotion, which policy then gates. Policies only ever add
 * requirements on top of this table, never take one away.
 */

export const ROLE_LABELS: Record<Role, string> = {
  viewer: 'Viewer',
  developer: 'Developer',
  maintainer: 'Maintainer',
  release_manager: 'Release manager',
  platform_admin: 'Platform admin',
  auditor: 'Auditor',
};

/** A role and every role it includes, for has_role(): a Platform admin is also a Maintainer. */
const INCLUDES: Record<Role, readonly Role[]> = {
  viewer: ['viewer'],
  auditor: ['auditor', 'viewer'],
  developer: ['developer', 'viewer'],
  maintainer: ['maintainer', 'developer', 'viewer'],
  release_manager: ['release_manager', 'developer', 'viewer'],
  platform_admin: [
    'platform_admin',
    'maintainer',
    'release_manager',
    'developer',
    'auditor',
    'viewer',
  ],
};

export function includedRoles(roles: Iterable<Role>): Set<Role> {
  const all = new Set<Role>();
  for (const role of roles) for (const included of INCLUDES[role]) all.add(included);
  return all;
}

const EVERYONE: readonly Role[] = [
  'viewer',
  'auditor',
  'developer',
  'maintainer',
  'release_manager',
  'platform_admin',
];
const BUILDERS: readonly Role[] = ['developer', 'maintainer', 'release_manager', 'platform_admin'];

/** The roles that may take an action, in the order a refusal suggests them (least first). */
export function rolesFor(action: AccessAction, protectedEnvironment: boolean): readonly Role[] {
  switch (action) {
    case 'view':
      return EVERYONE;
    case 'run':
    case 'request_prod':
      return BUILDERS;
    case 'deploy':
      return protectedEnvironment ? ['release_manager', 'platform_admin'] : BUILDERS;
    case 'rollback':
      return protectedEnvironment ? ['maintainer', 'release_manager', 'platform_admin'] : BUILDERS;
    case 'approve':
      return ['maintainer', 'release_manager', 'platform_admin'];
    case 'change_variables':
      // A protected environment's values reach it with the next deploy, which only these
      // roles may make there, so only they may change them.
      return protectedEnvironment
        ? ['release_manager', 'platform_admin']
        : ['maintainer', 'platform_admin'];
    case 'manage':
      return ['maintainer', 'platform_admin'];
    case 'platform':
      return ['platform_admin'];
  }
}

/** Actions whose decisions are stored with their trace (architecture §10.2, §20). */
export const PROTECTED_ACTIONS: ReadonlySet<AccessAction> = new Set([
  'deploy',
  'request_prod',
  'approve',
  'rollback',
  'change_variables',
  'manage',
  'platform',
]);

/** Actions policies are evaluated for, on top of roles. */
export const POLICY_ACTIONS: ReadonlySet<AccessAction> = new Set([
  'deploy',
  'request_prod',
  'approve',
  'rollback',
  'change_variables',
]);

/** "deploy checkout-api to Prod": the verb phrase a sentence is built around. */
export const ACTION_PHRASES: Record<AccessAction, string> = {
  view: 'view',
  run: 'run pipelines for',
  deploy: 'deploy',
  request_prod: 'request a Prod promotion for',
  approve: 'approve promotions of',
  rollback: 'roll back',
  change_variables: 'change variables of',
  manage: 'change the settings of',
  platform: 'administer',
};

/** "Maintainer", "Release manager or Platform admin". */
export function roleList(roles: readonly Role[]): string {
  const labels = roles.map((role) => ROLE_LABELS[role]);
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} or ${labels.at(-1) ?? ''}`;
}

/** "a Maintainer", "an Auditor". */
export function withArticle(label: string): string {
  return /^[aeiou]/i.test(label) ? `an ${label}` : `a ${label}`;
}
