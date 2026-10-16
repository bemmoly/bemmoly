import { insertMany } from './bulk.ts';
import { DAY, HOUR, uuidv7 } from './rng.ts';
import { team, type World } from './world.ts';

/*
 * Who may do what and when: role bindings at scopes, the Tier 0 and Tier 1 Prod policies
 * in the words of the product design, a December freeze, on-call (the demo person is
 * Payments primary until 18:00), release trains, templates and the fleet campaign.
 */

const TIER0 = {
  requester: 'has_role("maintainer")',
  approvals: [
    { from: 'owning_team', count: 2, exclude: ['authors'] },
    { from: 'oncall:sre', count: 1 },
  ],
  gates: ['tests', 'security_scan', 'staging_healthy("30m")', 'error_budget("> 0")', 'canary'],
  window: 'Mon-Thu 10:00-16:00 Asia/Kolkata',
  denyIf: 'freeze.active',
};
const TIER1 = {
  approvals: [{ from: 'owning_team', count: 1, exclude: ['authors'] }],
  gates: ['tests', 'security_scan', 'canary'],
  trainAllowed: true,
};

/** 18:00 today, or tomorrow when it is already later than that. */
function nextSixPm(now: Date): Date {
  const at = new Date(now);
  at.setHours(18, 0, 0, 0);
  if (at.getTime() <= now.getTime()) at.setTime(at.getTime() + DAY);
  return at;
}

export async function seedGovernance(world: World) {
  const { sql, rng, now } = world;
  const at = now.getTime() - 120 * DAY;
  const domain = (key: string) => world.domains.find((d) => d.key === key)?.id;
  const group = (key: string) =>
    world.groups.find((g) => g.key === key && g.domainKey === 'commerce')?.id;
  const bind = (name: string, role: string, scopeKind: string, scopeId: string | null = null) => ({
    subject_kind: 'team',
    subject_id: team(world, name).id,
    role,
    scope_kind: scopeKind,
    scope_id: scopeId,
  });
  await insertMany(sql, 'pipeline_role_bindings', [
    bind('All engineering', 'viewer', 'organisation'),
    bind('Commerce release managers', 'release_manager', 'domain', domain('commerce')),
    bind('Finance release managers', 'release_manager', 'domain', domain('finance')),
    bind('SRE', 'release_manager', 'organisation'),
    bind('Platform', 'platform_admin', 'organisation'),
    bind('Security', 'auditor', 'organisation'),
    bind('Checkout web', 'developer', 'group', group('checkout')),
  ]);
  const policies = [
    [
      'tier-0-to-prod',
      'Tier 0 to Prod',
      'application.tier == 0 && env.class == "prod"',
      TIER0,
      'Needs 2 approvals from the owning team, never the author, and 1 from SRE on call. Canary required. Only Mon to Thu, 10:00 to 16:00. Never during a freeze.',
    ],
    [
      'tier-1-to-prod',
      'Tier 1 to Prod',
      'application.tier == 1 && env.class == "prod"',
      TIER1,
      'Needs 1 approval from the owning team, or joins a release train. Canary required in the first region.',
    ],
  ] as const;
  for (const [index, [key, name, applies, requirements, sentence]] of policies.entries()) {
    const id = uuidv7(rng, at + index);
    await insertMany(sql, 'pipeline_policies', [
      { id, key, name, scope_kind: 'organisation', current_version: 1 },
    ]);
    await insertMany(sql, 'pipeline_policy_versions', [
      {
        policy_id: id,
        version: 1,
        applies,
        requirements,
        sentence,
        source: `name: ${name}\napplies: ${applies}\nrequire: ${JSON.stringify(requirements)}\n`,
      },
    ]);
  }
  const december = new Date(now.getFullYear(), 11, 20);
  if (december.getTime() < now.getTime()) december.setFullYear(december.getFullYear() + 1);
  await insertMany(sql, 'pipeline_freezes', [
    {
      name: 'Year-end freeze',
      scope_kind: 'organisation',
      environment_class: 'prod',
      starts_at: december,
      ends_at: new Date(december.getTime() + 14 * DAY),
      reason: 'Peak sales and reduced staffing',
    },
  ]);
  const sre = team(world, 'SRE');
  const ravi = world.people.find((p) => p.name === 'Ravi Kumar');
  const until = nextSixPm(now);
  await insertMany(sql, 'pipeline_oncall', [
    {
      schedule_key: 'payments-primary',
      team_id: team(world, 'Payments').id,
      user_id: world.demo.id,
      starts_at: new Date(until.getTime() - 12 * HOUR),
      ends_at: until,
    },
    {
      schedule_key: 'sre',
      team_id: sre.id,
      user_id: ravi?.id ?? sre.members[0],
      starts_at: new Date(now.getTime() - 6 * HOUR),
      ends_at: new Date(now.getTime() + 18 * HOUR),
    },
  ]);
  await insertMany(sql, 'pipeline_trains', [
    {
      key: 'commerce-1100',
      name: '11:00 Commerce train',
      scope_kind: 'domain',
      scope_id: domain('commerce'),
      schedule: '0 11 * * 1-5',
      timezone: 'Asia/Kolkata',
    },
    {
      key: 'commerce-1600',
      name: '16:00 Commerce train',
      scope_kind: 'domain',
      scope_id: domain('commerce'),
      schedule: '0 16 * * 1-5',
      timezone: 'Asia/Kolkata',
    },
  ]);
  const spec = (port: number) => ({
    inputs: { node: { default: '24' }, port: { default: port } },
    build: { dockerfile: 'Dockerfile' },
  });
  await insertMany(sql, 'pipeline_templates', [
    {
      ref: 'acme/node-service',
      version: 3,
      commit_sha: rng.hex(40),
      spec: spec(8080),
      latest: false,
    },
    {
      ref: 'acme/node-service',
      version: 4,
      commit_sha: rng.hex(40),
      spec: spec(8080),
      latest: true,
    },
    { ref: 'acme/go-service', version: 2, commit_sha: rng.hex(40), spec: spec(8080), latest: true },
  ]);
  const campaign = uuidv7(rng, now.getTime() - 6 * DAY);
  await insertMany(sql, 'pipeline_campaigns', [
    {
      id: campaign,
      name: 'node-service v4',
      template_ref: 'acme/node-service',
      from_version: 3,
      to_version: 4,
      wave_size: 50,
      state: 'running',
      created_by: world.demo.id,
    },
  ]);
  const onV3 = await sql<{ id: string }[]>`
    select id from pipeline_applications where template_ref in ('acme/node-service@3', 'acme/node-service@4')`;
  await insertMany(
    sql,
    'pipeline_campaign_targets',
    onV3.map((row, index) => ({
      campaign_id: campaign,
      application_id: row.id,
      wave: Math.floor(index / 50) + 1,
      state:
        index < 150
          ? 'merged'
          : index < 260
            ? rng.weighted([
                ['opened', 8],
                ['failing', 1],
              ])
            : rng.chance(0.03)
              ? 'ignored'
              : 'pending',
      pull_request_url: index < 260 ? `https://github.com/acme/pull/${4000 + index}` : null,
    })),
  );
  world.log('bindings, policies, freeze, on-call, trains, templates and a campaign');
}
