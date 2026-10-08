import type { ModuleGrant, Role, Team, TeamMember, User } from '@bemmoly/shared';
import { ago, uid } from './time.ts';

/** Data from the People mock's DCLogic block, in the identity stream's shapes. */
export const ROLE_IDS = {
  admin: uid(1),
  projectAdmin: uid(2),
  member: uid(3),
  viewer: uid(4),
  contractor: uid(5),
} as const;

const role = (id: string, key: string, name: string, userCount: number): Role => ({
  id,
  key,
  name,
  isSystem: true,
  userCount,
  createdAt: ago(60 * 24 * 30),
  updatedAt: ago(60 * 24 * 30),
});

export function seedRoles(): Role[] {
  return [
    role(ROLE_IDS.admin, 'org_admin', 'Org admin', 1),
    role(ROLE_IDS.projectAdmin, 'project_admin', 'Project admin', 1),
    role(ROLE_IDS.member, 'member', 'Member', 4),
    role(ROLE_IDS.viewer, 'viewer', 'Viewer', 1),
    role(ROLE_IDS.contractor, 'contractor', 'Contractor', 1),
  ];
}

export const TEAM_IDS = {
  platform: uid(20),
  mobile: uid(21),
  growth: uid(22),
  design: uid(23),
  people: uid(24),
  leadership: uid(25),
} as const;

export const USER_IDS = {
  rohan: uid(40),
  priya: uid(41),
  aisha: uid(42),
  jonas: uid(43),
  lena: uid(44),
  maya: uid(45),
  dev: uid(46),
  sam: uid(47),
} as const;

type Row = [keyof typeof USER_IDS, string, string, string, string[], number | null];
const ROWS: Row[] = [
  [
    'rohan',
    'Rohan S.',
    'rohan@acmelabs.dev',
    ROLE_IDS.admin,
    [TEAM_IDS.platform, TEAM_IDS.growth],
    0,
  ],
  ['priya', 'Priya N.', 'priya@acmelabs.dev', ROLE_IDS.projectAdmin, [TEAM_IDS.platform], 2],
  ['aisha', 'Aisha K.', 'aisha@acmelabs.dev', ROLE_IDS.member, [TEAM_IDS.platform], 3],
  [
    'jonas',
    'Jonas M.',
    'jonas@acmelabs.dev',
    ROLE_IDS.member,
    [TEAM_IDS.platform, TEAM_IDS.mobile],
    26,
  ],
  ['lena', 'Lena T.', 'lena@acmelabs.dev', ROLE_IDS.member, [TEAM_IDS.growth, TEAM_IDS.design], 28],
  ['maya', 'Maya K.', 'maya@acmelabs.dev', ROLE_IDS.member, [TEAM_IDS.people], 96],
  ['dev', 'Dev P.', 'dev@contractor.io', ROLE_IDS.contractor, [TEAM_IDS.mobile], 288],
  ['sam', 'Sam R.', 'sam@acmelabs.dev', ROLE_IDS.viewer, [], null],
];

export function makeUser(id: string, name: string, email: string, roleId: string): User {
  return {
    id,
    email,
    name,
    avatarKey: null,
    status: 'active',
    isBreakGlass: false,
    roleId,
    teamIds: [],
    themePref: null,
    locale: null,
    timezone: null,
    lastSeenAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
}

/** Accounts only: Sam (hours null) is invited and, as on the server, has no account yet. */
export function seedUsers(): User[] {
  return ROWS.flatMap(([key, name, email, roleId, teamIds, hours]) =>
    hours === null
      ? []
      : [
          {
            ...makeUser(USER_IDS[key], name, email, roleId),
            isBreakGlass: key === 'rohan',
            teamIds,
            lastSeenAt: ago(hours * 60),
            createdAt: ago(60 * 24 * 20),
          },
        ],
  );
}

export function seedTeams(): { teams: Team[]; members: TeamMember[] } {
  const rows: Array<[string, string, string, string, number]> = [
    [TEAM_IDS.platform, 'Platform', '#2456c9', USER_IDS.priya, 14],
    [TEAM_IDS.mobile, 'Mobile', '#1f7a44', USER_IDS.jonas, 6],
    [TEAM_IDS.growth, 'Growth', '#b4530f', USER_IDS.rohan, 5],
    [TEAM_IDS.design, 'Design', '#be123c', USER_IDS.lena, 4],
    [TEAM_IDS.people, 'People ops', '#8b5cf6', USER_IDS.maya, 3],
    [TEAM_IDS.leadership, 'Leadership', '#64748b', USER_IDS.rohan, 4],
  ];
  const teams = rows.map(([id, name, color, leadUserId, memberCount]) => ({
    id,
    name,
    color,
    leadUserId,
    defaultRoleId: id === TEAM_IDS.leadership ? ROLE_IDS.viewer : ROLE_IDS.member,
    memberCount,
    createdAt: ago(60 * 24 * 20),
    updatedAt: ago(60 * 24 * 2),
  }));
  const members = seedUsers().flatMap((user) =>
    user.teamIds.map((teamId) => ({ teamId, userId: user.id, createdAt: ago(60 * 24 * 10) })),
  );
  return { teams, members };
}

export function seedGrants(): ModuleGrant[] {
  return [
    {
      id: uid(60),
      moduleId: 'sample',
      subjectKind: 'everyone',
      subjectId: null,
      grantedBy: USER_IDS.rohan,
      createdAt: ago(60 * 24 * 3),
    },
  ];
}
