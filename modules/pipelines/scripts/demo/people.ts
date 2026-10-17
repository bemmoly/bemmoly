import { insertMany } from './bulk.ts';
import { FIRST_NAMES, LAST_NAMES, NON_OWNING_TEAMS, teamNames } from './names.ts';
import { uuidv7 } from './rng.ts';
import type { Person, SeedContext, Team } from './world.ts';

/*
 * Acme's people and teams, in the kernel's own tables: 512 engineers with @acme.example
 * addresses (the marker --reset removes them by) and 54 teams. The demo person is whoever
 * administers this install, so the screens they open are full of their own work.
 */

export const SEED_EMAIL_DOMAIN = 'acme.example';

/** People the product design names, and the teams they sit in. */
const FEATURED: readonly (readonly [string, readonly string[]])[] = [
  ['Ana Ruiz', ['Payments']],
  ['Jon Mathew', ['Checkout web']],
  ['Lin Tan', ['Payments', 'Commerce release managers']],
  ['Ravi Kumar', ['SRE', 'Payments']],
];

const emailOf = (name: string) =>
  `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@${SEED_EMAIL_DOMAIN}`;

async function roleId(ctx: SeedContext, key: string): Promise<string> {
  const [row] = await ctx.sql<{ id: string }[]>`select id from roles where key = ${key}`;
  if (!row) throw new Error(`The kernel has no ${key} role; run the changelog first`);
  return row.id;
}

/** The earliest org admin, or Priya Sharma as a member when the install has none yet. */
async function demoPerson(ctx: SeedContext, memberRole: string): Promise<Person> {
  const [admin] = await ctx.sql<Person[]>`
    select u.id, u.name from users u join roles r on r.id = u.role_id
    where r.key = 'org_admin' and u.status = 'active' order by u.created_at limit 1`;
  if (admin) return admin;
  const [created] = await ctx.sql<Person[]>`
    insert into users (email, name, role_id)
    values (${emailOf('Priya Sharma')}, 'Priya Sharma', ${memberRole})
    returning id, name`;
  if (!created) throw new Error('Could not create the demo person');
  return created;
}

function generatedNames(ctx: SeedContext, count: number, taken: Set<string>): string[] {
  const names: string[] = [];
  while (names.length < count) {
    const name = `${ctx.rng.pick(FIRST_NAMES)} ${ctx.rng.pick(LAST_NAMES)}`;
    if (taken.has(name)) continue;
    taken.add(name);
    names.push(name);
  }
  return names;
}

export async function seedPeople(ctx: SeedContext) {
  const memberRole = await roleId(ctx, 'member');
  const demo = await demoPerson(ctx, memberRole);
  const at = ctx.now.getTime() - 400 * 86_400_000;
  const taken = new Set<string>([demo.name, 'Priya Sharma', ...FEATURED.map(([name]) => name)]);
  const total = Math.max(40, Math.round(512 * ctx.scale));
  const names = [
    ...FEATURED.map(([name]) => name),
    ...generatedNames(ctx, total - FEATURED.length - 1, taken),
  ];
  const people: Person[] = names.map((name, index) => ({ id: uuidv7(ctx.rng, at + index), name }));
  await insertMany(
    ctx.sql,
    'users',
    people.map((person) => ({
      id: person.id,
      email: emailOf(person.name),
      name: person.name,
      role_id: memberRole,
    })),
  );

  const teams = new Map<string, Team>();
  const all = teamNames();
  await insertMany(
    ctx.sql,
    'teams',
    all.map((name, index) => ({ id: uuidv7(ctx.rng, at + index), name })),
    // An install may already have a team called Platform or Security; Acme joins it.
    { skipConflicts: true },
  );
  const rows = await ctx.sql<{ id: string; name: string }[]>`
    select id, name from teams where name = any(${all}::text[])`;
  for (const row of rows) teams.set(row.name, { id: row.id, name: row.name, members: [] });

  const join = (teamName: string, personId: string) => {
    const found = teams.get(teamName);
    if (found && !found.members.includes(personId)) found.members.push(personId);
  };
  for (const name of ['Payments', 'Checkout web']) join(name, demo.id);
  FEATURED.forEach(([, memberOf], index) => {
    const person = people[index];
    if (person) for (const name of memberOf) join(name, person.id);
  });
  const owning = all.filter((name) => !NON_OWNING_TEAMS.includes(name));
  people.forEach((person, index) => {
    if (index >= FEATURED.length) join(owning[index % owning.length] ?? 'Platform', person.id);
    join('All engineering', person.id);
    if (ctx.rng.chance(0.12)) join(ctx.rng.pick(NON_OWNING_TEAMS), person.id);
  });
  join('All engineering', demo.id);
  const memberships = [...teams.values()].flatMap((found) =>
    found.members.map((userId) => ({ team_id: found.id, user_id: userId })),
  );
  await insertMany(ctx.sql, 'team_members', memberships, { skipConflicts: true });
  ctx.log(`${people.length + 1} people, ${teams.size} teams`);
  return { demo, people, teams };
}
