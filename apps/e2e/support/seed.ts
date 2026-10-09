import { request, type APIRequestContext } from '@playwright/test';
import { statePath, type Person } from './state.ts';

/**
 * The people of a run, created the way a real install gets them: the setup
 * wizard's endpoints for the first admin, then invitations accepted through
 * the links the admin hands out when email is not set up.
 */
const ADMIN = { name: 'Rohan S.', email: 'rohan@acmelabs.dev', password: 'correct horse battery' };
const MEMBER = { name: 'Sam R.', email: 'sam@acmelabs.dev', password: 'twelve chars ok' };
const OBSERVER = { name: 'Priya K.', email: 'priya@acmelabs.dev', password: 'twelve chars ok' };
const DRIVER = { name: 'Jonas M.', email: 'jonas@acmelabs.dev', password: 'twelve chars ok' };
/** More org admins, one per parallel worker, so no one person's request budget runs out. */
const CO_ADMINS = ['Lena', 'Omar', 'Mei'].map((name) => ({
  name: `${name} A.`,
  email: `${name.toLowerCase()}@acmelabs.dev`,
  password: 'twelve chars ok',
}));

async function expectOk(response: Awaited<ReturnType<APIRequestContext['get']>>, what: string) {
  if (!response.ok()) throw new Error(`${what}: ${response.status()} ${await response.text()}`);
  return response.json() as Promise<Record<string, unknown>>;
}

/** A client that sends the same-origin header the CSRF check wants. */
export async function apiAs(baseURL: string, storageState?: string): Promise<APIRequestContext> {
  return request.newContext({
    baseURL,
    extraHTTPHeaders: { origin: baseURL },
    ...(storageState ? { storageState } : {}),
  });
}

async function saveSession(api: APIRequestContext, file: string): Promise<string> {
  const path = statePath(file);
  await api.storageState({ path });
  return path;
}

export interface SeededPeople {
  admin: Person;
  admins: Person[];
  member: Person;
  observer: Person;
  driver: Person;
  team: { id: string; name: string };
}

export async function seedPeople(baseURL: string): Promise<SeededPeople> {
  const admin = await apiAs(baseURL);
  const created = await expectOk(
    await admin.post('/api/v1/setup/admin', {
      data: { workspaceName: 'Acme Labs', workspaceUrl: baseURL, ...ADMIN },
    }),
    'setup admin',
  );
  const adminId = (created['user'] as { id: string }).id;
  // The wizard's last step records that setup finished, which opens the app.
  await expectOk(
    await admin.put('/api/v1/admin/settings/setup.completedAt', {
      data: { value: new Date().toISOString() },
    }),
    'finish setup',
  );
  const team = await expectOk(
    await admin.post('/api/v1/teams', { data: { name: 'Platform', leadUserId: adminId } }),
    'create team',
  );
  await expectOk(
    await admin.put(`/api/v1/teams/${String(team['id'])}/members/${adminId}`),
    'join team',
  );
  const roles = (await expectOk(await admin.get('/api/v1/roles'), 'roles'))['items'] as {
    id: string;
    key: string;
  }[];
  const memberRole = roles.find((role) => role.key === 'member')?.id;
  const adminRole = roles.find((role) => role.key === 'org_admin')?.id;
  const member = await invite(admin, baseURL, MEMBER, memberRole);
  const observer = await invite(admin, baseURL, OBSERVER, memberRole);
  const driver = await invite(admin, baseURL, DRIVER, memberRole);
  const coAdmins: Person[] = [];
  for (const who of CO_ADMINS) coAdmins.push(await invite(admin, baseURL, who, adminRole));
  const adminPerson = {
    id: adminId,
    ...ADMIN,
    storageState: await saveSession(admin, 'admin.json'),
  };
  await admin.dispose();
  return {
    admin: adminPerson,
    admins: [adminPerson, ...coAdmins],
    member,
    observer,
    driver,
    team: { id: String(team['id']), name: String(team['name']) },
  };
}

async function invite(
  admin: APIRequestContext,
  baseURL: string,
  who: typeof MEMBER,
  roleId: string | undefined,
): Promise<Person> {
  const invited = await expectOk(
    await admin.post('/api/v1/invitations', { data: { emails: [who.email], roleId } }),
    `invite ${who.email}`,
  );
  const [item] = invited['items'] as { acceptUrl: string }[];
  if (!item) throw new Error(`no invitation for ${who.email}`);
  const token = new URL(item.acceptUrl).hash.replace('#token=', '');
  const browser = await apiAs(baseURL);
  const accepted = await expectOk(
    await browser.post(`/api/v1/auth/invitations/${token}/accept`, {
      data: { name: who.name, password: who.password },
    }),
    `accept ${who.email}`,
  );
  const id = (accepted['user'] as { id: string } | undefined)?.id;
  const me = await expectOk(await browser.get('/api/v1/me'), `${who.email} session`);
  const person: Person = {
    id: id ?? (me['user'] as { id: string }).id,
    ...who,
    storageState: await saveSession(browser, `${who.email.split('@')[0]}.json`),
  };
  await browser.dispose();
  return person;
}
