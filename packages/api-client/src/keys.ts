import {
  AI_PLAN_REALTIME_KIND,
  AI_REALTIME_KINDS,
  type NotificationsQuery,
  type SettingKey,
} from '@bemmoly/shared';

const AI_INSIGHT_KIND = AI_REALTIME_KINDS.insight;
import type { BackupsFilter } from './endpoints/operations-admin.ts';
import type { AuditFilter } from './endpoints/operations.ts';
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
  oauth: {
    all: () => ['oauth'] as const,
    grants: () => ['oauth', 'grants'] as const,
    /** One authorization request's consent screen, keyed by its query string. */
    preview: (query: string) => ['oauth', 'preview', query] as const,
  },
  sso: {
    all: () => ['sso'] as const,
    signInOptions: () => ['sso', 'sign-in-options'] as const,
    providers: () => ['sso', 'providers'] as const,
    policy: () => ['sso', 'policy'] as const,
    scimTokens: () => ['sso', 'scim-tokens'] as const,
  },
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
  imports: {
    all: () => ['imports'] as const,
    sources: () => ['imports', 'sources'] as const,
    list: () => ['imports', 'list'] as const,
    detail: (id: string) => ['imports', 'job', id] as const,
  },
  codeHosts: {
    all: () => ['code-hosts'] as const,
    list: () => ['code-hosts', 'list'] as const,
    deliveries: (id: string) => ['code-hosts', 'deliveries', id] as const,
  },
  updates: () => ['updates'] as const,
  system: () => ['system'] as const,
  audit: {
    all: () => ['audit'] as const,
    list: (filter: AuditFilter = {}) => ['audit', 'list', filter] as const,
  },
  ai: {
    all: () => ['ai'] as const,
    /** What a signed-in person's client needs to draw AI surfaces. */
    status: () => ['ai', 'status'] as const,
    settings: () => ['ai', 'settings'] as const,
    exclusionTargets: () => ['ai', 'exclusion-targets'] as const,
    catalog: () => ['ai', 'catalog'] as const,
    catalogProvider: (id: string) => ['ai', 'catalog', id] as const,
    providers: () => ['ai', 'providers'] as const,
    roles: () => ['ai', 'roles'] as const,
    usage: (month = '') => ['ai', 'usage', month] as const,
    prompts: () => ['ai', 'prompts'] as const,
    promptDiff: (id: string) => ['ai', 'prompts', id, 'diff'] as const,
    /** The palette's plans; one is refetched as its run job announces each step. */
    plans: () => ['ai', 'plans'] as const,
    plan: (id: string) => ['ai', 'plans', id] as const,
    /** Cached insights; one target's are refetched when `ai.insight` names it. */
    insights: () => ['ai', 'insights'] as const,
    insight: (kind: string, targetId: string) => ['ai', 'insights', kind, targetId] as const,
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
  // AI on or off changes what /me says (workspace.aiEnabled) and every AI surface with it.
  // A plan's progress refreshes only the plans: it says nothing about AI being on.
  [(kind) => kind === AI_PLAN_REALTIME_KIND, () => [queryKeys.ai.plans()]],
  // A regenerated insight refreshes the insights only: it says nothing about AI being on.
  [(kind) => kind === AI_INSIGHT_KIND, () => [queryKeys.ai.insights()]],
  [
    (kind) =>
      kind === 'ai' ||
      (kind.startsWith('ai.') && kind !== AI_PLAN_REALTIME_KIND && kind !== AI_INSIGHT_KIND),
    () => [queryKeys.ai.all(), queryKeys.me(), queryKeys.settings.all()],
  ],
  [(kind) => kind.startsWith('work.'), () => [queryKeys.work()]],
  [(kind) => kind.startsWith('docs.'), () => [queryKeys.docs()]],
];

/** Which cached queries a realtime event makes stale. Unknown kinds invalidate nothing. */
export function keysForEvent(kind: string): QueryKey[] {
  return EVENT_KEYS.filter(([match]) => match(kind)).flatMap(([, keys]) => keys());
}
