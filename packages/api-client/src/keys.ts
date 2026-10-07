import type { AuditQuery, NotificationsQuery, OutboxStatus, UsersQuery } from '@bemmoly/shared';
import type { SettingName } from './endpoints/settings.ts';

/**
 * TanStack Query keys, one factory so invalidation is never a guess. Each
 * group's first element is its root, so invalidating `['users']` clears every
 * users list regardless of filters.
 */
export const queryKeys = {
  setupStatus: () => ['setup', 'status'] as const,
  me: () => ['session', 'me'] as const,
  modules: () => ['modules'] as const,
  adminModules: () => ['admin-modules'] as const,
  users: {
    all: () => ['users'] as const,
    list: (query: UsersQuery = {}) => ['users', 'list', query] as const,
  },
  teams: () => ['teams'] as const,
  roles: {
    all: () => ['roles'] as const,
    capabilities: (roleId: string) => ['roles', roleId, 'capabilities'] as const,
  },
  capabilities: () => ['capabilities'] as const,
  moduleGrants: () => ['module-grants'] as const,
  apiTokens: () => ['api-tokens'] as const,
  settings: {
    all: () => ['settings'] as const,
    one: (name: SettingName) => ['settings', name] as const,
  },
  notifications: {
    all: () => ['notifications'] as const,
    list: (query: NotificationsQuery = {}) => ['notifications', 'list', query] as const,
    preferences: () => ['notifications', 'preferences'] as const,
  },
  email: {
    outbox: (status?: OutboxStatus) => ['email', 'outbox', status ?? 'all'] as const,
    devMailbox: () => ['email', 'dev-mailbox'] as const,
  },
  backups: () => ['backups'] as const,
  updates: () => ['updates'] as const,
  system: () => ['system'] as const,
  audit: {
    all: () => ['audit'] as const,
    list: (query: AuditQuery = {}) => ['audit', 'list', query] as const,
  },
  search: (q: string, kinds: readonly string[] = []) => ['search', q, kinds] as const,
} as const;

export type QueryKey = readonly unknown[];

const EVENT_PREFIXES: ReadonlyArray<[prefix: string, keys: () => QueryKey[]]> = [
  ['notification.', () => [queryKeys.notifications.all()]],
  ['user.', () => [queryKeys.users.all(), queryKeys.me()]],
  ['team.', () => [queryKeys.teams(), queryKeys.users.all()]],
  ['role.', () => [queryKeys.roles.all(), queryKeys.me()]],
  ['module.', () => [queryKeys.modules(), queryKeys.adminModules(), queryKeys.moduleGrants()]],
  ['setting.', () => [queryKeys.settings.all(), queryKeys.me()]],
  ['backup.', () => [queryKeys.backups(), queryKeys.system()]],
  ['update.', () => [queryKeys.updates(), queryKeys.system()]],
  ['email.', () => [['email']]],
];

/** Which cached queries a realtime event makes stale. Unknown kinds invalidate nothing. */
export function keysForEvent(kind: string): QueryKey[] {
  return EVENT_PREFIXES.filter(([prefix]) => kind.startsWith(prefix)).flatMap(([, keys]) => keys());
}
