import type {
  AdminModule,
  ApiToken,
  AuditEntry,
  Backup,
  DevMailbox,
  Invitation,
  ModuleGrant,
  ModuleManifest,
  Notification,
  NotificationPreferences,
  OutboxSummary,
  Role,
  SettingKey,
  SystemHealthResponse,
  Team,
  TeamMember,
  UpdatesOverview,
  User,
} from '@bemmoly/shared';
import { seedCapabilities, type CapabilityRow, type Cells } from './seed/capabilities.ts';
import { seedAudit, seedBackups, seedOutbox, seedSystem, seedUpdates } from './seed/operations.ts';
import { seedGrants, seedRoles, seedTeams, seedUsers, USER_IDS } from './seed/people.ts';
import { newId } from './seed/time.ts';
import {
  seedAdminModules,
  seedManifests,
  seedNotifications,
  seedPreferences,
  seedSettings,
} from './seed/workspace.ts';

/**
 * fresh: no admin yet, the wizard runs. ready: set up, signed in as the admin.
 * signed-out: set up, nobody signed in. member: signed in without admin rights.
 * wizard: the admin exists but has not finished the wizard.
 */
export type MockScenario = 'fresh' | 'wizard' | 'ready' | 'signed-out' | 'member';

export const MOCK_SCENARIOS: readonly MockScenario[] = [
  'fresh',
  'wizard',
  'ready',
  'signed-out',
  'member',
];

/** Every seeded person signs in with this password in development. */
export const MOCK_PASSWORD = 'correct horse battery';

export interface MockDb {
  scenario: MockScenario;
  initialized: boolean;
  signedInAs: string | null;
  settings: Partial<Record<SettingKey, unknown>>;
  users: User[];
  passwords: Record<string, string>;
  invitations: Invitation[];
  /** token → invitation id; tokens are 16+ characters as the identity stream requires. */
  invitationTokens: Record<string, string>;
  resetTokens: Record<string, string>;
  teams: Team[];
  teamMembers: TeamMember[];
  roles: Role[];
  capabilities: CapabilityRow[];
  cells: Cells;
  grants: ModuleGrant[];
  adminModules: AdminModule[];
  /** BEMMOLY_MODULES is set: the module set is read-only. */
  modulesPinned: boolean;
  manifests: ModuleManifest[];
  notifications: Notification[];
  preferences: NotificationPreferences;
  outbox: OutboxSummary;
  mailbox: DevMailbox['items'];
  backups: Backup[];
  updates: UpdatesOverview;
  system: SystemHealthResponse;
  audit: AuditEntry[];
  apiTokens: ApiToken[];
  /** Realtime invalidations waiting for the socket bridge: [kind, userId, ids]. */
  outbound: Array<[string, string | null, string[]]>;
}

// Plain words, not random-looking: the schemas only need 16 characters, and a secret
// scanner should never mistake a fixture for a credential.
export const INVITE_TOKEN = 'mock-invitation-for-sam';
export const RESET_TOKEN = 'mock-password-reset-for-rohan';

export function createMockDb(scenario: MockScenario = 'ready'): MockDb {
  const fresh = scenario === 'fresh';
  const users = fresh ? [] : seedUsers();
  const { teams, members } = seedTeams();
  const { rows, cells } = seedCapabilities();
  const backups = seedBackups();
  const invitation: Invitation | null = fresh
    ? null
    : {
        id: newId(),
        email: 'sam@acmelabs.dev',
        roleId: users.find((user) => user.id === USER_IDS.sam)?.roleId ?? '',
        teamId: null,
        invitedBy: USER_IDS.rohan,
        expiresAt: new Date(Date.now() + 6 * 86_400_000).toISOString(),
        acceptedAt: null,
        revokedAt: null,
        createdAt: new Date().toISOString(),
      };
  return {
    scenario,
    initialized: !fresh,
    signedInAs: ['ready', 'wizard'].includes(scenario)
      ? USER_IDS.rohan
      : scenario === 'member'
        ? USER_IDS.aisha
        : null,
    settings: seedSettings(scenario !== 'fresh' && scenario !== 'wizard'),
    users,
    passwords: Object.fromEntries(users.map((user) => [user.email, MOCK_PASSWORD])),
    invitations: invitation ? [invitation] : [],
    invitationTokens: invitation ? { [INVITE_TOKEN]: invitation.id } : {},
    resetTokens: fresh ? {} : { [RESET_TOKEN]: 'rohan@acmelabs.dev' },
    teams: fresh ? [] : teams,
    teamMembers: fresh ? [] : members,
    roles: seedRoles(),
    capabilities: rows,
    cells,
    grants: fresh ? [] : seedGrants(),
    adminModules: seedAdminModules(!fresh),
    modulesPinned: false,
    manifests: seedManifests(!fresh),
    notifications: fresh ? [] : seedNotifications(),
    preferences: seedPreferences(),
    outbox: seedOutbox(),
    mailbox: [],
    backups,
    updates: seedUpdates(),
    system: seedSystem(),
    audit: fresh ? [] : seedAudit(),
    apiTokens: [],
    outbound: [],
  };
}

export function currentUser(db: MockDb): User | undefined {
  return db.users.find((user) => user.id === db.signedInAs);
}

export function roleOf(db: MockDb, user: User | undefined): Role | undefined {
  return db.roles.find((role) => role.id === user?.roleId);
}

export function capabilitiesOf(db: MockDb, user: User | undefined): string[] {
  const role = roleOf(db, user);
  if (!role) return [];
  if (role.key === 'org_admin') return db.capabilities.map((row) => row.name);
  return db.capabilities
    .filter((row) => db.cells[row.name]?.[role.id]?.allowed)
    .map((row) => row.name);
}

export function can(db: MockDb, capability: string): boolean {
  return capabilitiesOf(db, currentUser(db)).includes(capability);
}

/** Queues a realtime invalidation addressed to the signed-in person. */
export function emit(db: MockDb, kind: string, ids: string[]): void {
  db.outbound.push([kind, db.signedInAs, ids]);
}

export function audit(
  db: MockDb,
  action: string,
  targetKind: string,
  targetId: string | null,
): void {
  db.audit.unshift({
    id: newId(),
    actorId: db.signedInAs,
    actorKind: db.signedInAs ? 'user' : 'system',
    actorUserId: db.signedInAs,
    action,
    targetKind,
    targetId,
    before: null,
    after: null,
    ip: '127.0.0.1',
    requestId: `mock-${db.audit.length}`,
    aiPlanId: null,
    createdAt: new Date().toISOString(),
  });
}
