import type { NotificationsQuery, SettingKey } from '@bemmoly/shared';
import type { AuditFilter, BackupsFilter } from './endpoints/operations.ts';
import type { UsersFilter } from './endpoints/people.ts';

/**
 * TanStack Query keys, one factory so invalidation is never a guess. Each
 * group's first element is its root, so invalidating `['users']` clears every
 * users list regardless of filters.
 */
export const queryKeys = {
  setupStatus: () => ['setup', 'status'] as const,
  readiness: () => ['setup', 'readiness'] as const,
  me: () => ['session', 'me'] as const,
  sessions: () => ['session', 'list'] as const,
  modules: () => ['modules'] as const,
  adminModules: () => ['admin-modules'] as const,
  users: {
    all: () => ['users'] as const,
    list: (filter: UsersFilter = {}) => ['users', 'list', filter] as const,
  },
  invitations: () => ['invitations'] as const,
  teams: {
    all: () => ['teams'] as const,
    members: (teamId: string) => ['teams', teamId, 'members'] as const,
  },
  roles: () => ['roles'] as const,
  capabilities: () => ['capabilities'] as const,
  moduleGrants: () => ['module-grants'] as const,
  apiTokens: () => ['api-tokens'] as const,
  settings: {
    all: () => ['settings'] as const,
    many: (keys: readonly SettingKey[]) => ['settings', ...keys] as const,
  },
  notifications: {
    all: () => ['notifications'] as const,
    list: (query: NotificationsQuery = {}) => ['notifications', 'list', query] as const,
    preferences: () => ['notifications', 'preferences'] as const,
  },
  email: {
    outbox: () => ['email', 'outbox'] as const,
    devMailbox: () => ['email', 'dev-mailbox'] as const,
  },
  backups: {
    all: () => ['backups'] as const,
    list: (filter: BackupsFilter = {}) => ['backups', 'list', filter] as const,
  },
  updates: () => ['updates'] as const,
  system: () => ['system'] as const,
  audit: {
    all: () => ['audit'] as const,
    list: (filter: AuditFilter = {}) => ['audit', 'list', filter] as const,
  },
  search: (q: string, kinds: readonly string[] = []) => ['search', q, kinds] as const,
  /** The Work module's root; its own factory (workKeys) nests everything under it. */
  work: () => ['work'] as const,
  /** The Docs module's root; its own factory (docsKeys) nests everything under it. */
  docs: () => ['docs'] as const,
} as const;

export type QueryKey = readonly unknown[];

/** Kinds the realtime hub sends; `notifications` is confirmed, the rest are prefixes. */
const EVENT_KEYS: ReadonlyArray<[match: (kind: string) => boolean, keys: () => QueryKey[]]> = [
  [
    (kind) => kind === 'notifications' || kind.startsWith('notification.'),
    () => [queryKeys.notifications.all()],
  ],
  [(kind) => kind.startsWith('user.'), () => [queryKeys.users.all(), queryKeys.me()]],
  [(kind) => kind.startsWith('team.'), () => [queryKeys.teams.all(), queryKeys.users.all()]],
  [
    (kind) => kind.startsWith('role.'),
    () => [queryKeys.roles(), queryKeys.capabilities(), queryKeys.me()],
  ],
  [
    (kind) => kind.startsWith('module.'),
    () => [queryKeys.modules(), queryKeys.adminModules(), queryKeys.moduleGrants()],
  ],
  [(kind) => kind.startsWith('setting'), () => [queryKeys.settings.all()]],
  [
    (kind) => kind.startsWith('backup') || kind === 'system.backup',
    () => [queryKeys.backups.all(), queryKeys.system()],
  ],
  [(kind) => kind.startsWith('update.'), () => [queryKeys.updates(), queryKeys.system()]],
  [(kind) => kind.startsWith('email.'), () => [['email']]],
  [(kind) => kind.startsWith('work.'), () => [queryKeys.work()]],
  [(kind) => kind.startsWith('docs.'), () => [queryKeys.docs()]],
];

/** Which cached queries a realtime event makes stale. Unknown kinds invalidate nothing. */
export function keysForEvent(kind: string): QueryKey[] {
  return EVENT_KEYS.filter(([match]) => match(kind)).flatMap(([, keys]) => keys());
}
