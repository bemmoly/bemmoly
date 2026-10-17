import { insertMany, type Row } from './bulk.ts';
import { DOMAINS, SUFFIXES, type GroupSpec } from './names.ts';
import { uuidv7 } from './rng.ts';
import type { AppInfo, SeedContext, Team, World } from './world.ts';

/*
 * Domain › Group › Application. The applications the product design names come first with
 * the owners, tiers and repositories it shows; the rest are generated per group so the mix
 * matches the design's counts (41 Tier 0, 188 Tier 1; 612 container services, 401 on
 * Kubernetes, 97 functions, 30 static sites; 612 on node-service v3).
 */

type Featured = readonly [string, string, string, string | null, number, string, number[]];

/** key, domain, group, owning team, tier, repository, start version (history bumps patches). */
const FEATURED: readonly Featured[] = [
  ['checkout-api', 'commerce', 'checkout', 'Payments', 0, 'acme/checkout', [1, 42, 0]],
  ['payments-worker', 'commerce', 'checkout', 'Payments', 0, 'acme/payments-worker', [0, 19, 0]],
  ['order-history', 'commerce', 'checkout', 'Payments', 2, 'acme/order-history', [3, 0, 0]],
  ['gift-cards', 'commerce', 'checkout', null, 2, 'acme/gift-cards', [0, 4, 0]],
  ['pricing-svc', 'commerce', 'pricing', 'Pricing', 1, 'acme/pricing', [2, 17, 0]],
  ['promo-engine', 'commerce', 'pricing', 'Pricing', 2, 'acme/promo-engine', [1, 2, 0]],
  ['cart-api', 'commerce', 'cart-and-catalog', 'Cart', 1, 'acme/cart-api', [8, 2, 0]],
  ['search-api', 'commerce', 'cart-and-catalog', 'Cart', 1, 'acme/search-api', [0, 30, 0]],
  ['storefront-web', 'commerce', 'storefront', 'Checkout web', 1, 'acme/storefront', [2, 7, 0]],
  ['refunds-api', 'commerce', 'payments', 'Payments', 0, 'acme/payments-mono', [4, 3, 0]],
  ['ledger-api', 'commerce', 'payments', 'Payments', 0, 'acme/payments-mono', [5, 1, 0]],
  ['payouts-worker', 'commerce', 'payments', 'Payments', 0, 'acme/payments-mono', [1, 8, 0]],
  ['loyalty-legacy', 'commerce', 'orders', null, 2, 'acme/loyalty-legacy', [0, 9, 0]],
  ['route-planner', 'logistics', 'routing', 'Logistics core', 1, 'acme/route-planner', [3, 4, 0]],
  ['web-app', 'growth', 'marketing', 'Growth web', 1, 'acme/web-app', [6, 1, 0]],
  ['admin-portal', 'internal-tools', 'admin', 'Admin tools', 2, 'acme/admin-portal', [2, 0, 0]],
];

const LANGUAGES = ['java', 'python', 'kotlin', 'node', 'go'] as const;

interface Draft {
  key: string;
  domainKey: string;
  group: GroupSpec;
  team: string | null;
  tier: number | null;
  repo: string | null;
  start: number[] | null;
}

function draftApps(ctx: SeedContext): Draft[] {
  const drafts: Draft[] = [];
  const used = new Set(FEATURED.map(([key]) => key));
  for (const domain of DOMAINS) {
    for (const group of domain.groups) {
      const featured = FEATURED.filter(([, d, g]) => d === domain.key && g === group.key);
      for (const [key, , , team, tier, repo, start] of featured) {
        drafts.push({ key, domainKey: domain.key, group, team, tier, repo, start });
      }
      const count = Math.max(featured.length + 1, Math.round(group.count * ctx.scale));
      for (let index = featured.length; index < count; index += 1) {
        let key = `${ctx.rng.pick(group.words)}-${ctx.rng.pick(SUFFIXES)}`;
        for (let n = 2; used.has(key); n += 1) key = `${key.replace(/-\d+$/, '')}-${n}`;
        used.add(key);
        const team = group.teams[index % 3 === 2 ? group.teams.length - 1 : 0] ?? null;
        drafts.push({
          key,
          domainKey: domain.key,
          group,
          team,
          tier: null,
          repo: null,
          start: null,
        });
      }
    }
  }
  return drafts;
}

/** Tiers, runtimes and templates dealt out to match the design's counts at this scale. */
function deal(ctx: SeedContext, drafts: Draft[]) {
  const scaled = (n: number) => Math.round(n * ctx.scale);
  const order = ctx.rng.shuffle(drafts.filter((d) => d.tier === null));
  const critical = order.filter((d) => ['commerce', 'finance', 'identity'].includes(d.domainKey));
  let zero = scaled(41) - drafts.filter((d) => d.tier === 0).length;
  for (const draft of critical) if (zero-- > 0) draft.tier = 0;
  let one = scaled(188) - drafts.filter((d) => d.tier === 1).length;
  for (const draft of order) if (draft.tier === null) draft.tier = one-- > 0 ? 1 : 2;
  const deck = (counts: readonly (readonly [string | null, number])[]) =>
    ctx.rng.shuffle(counts.flatMap(([value, n]) => Array.from({ length: scaled(n) }, () => value)));
  return {
    runtimes: deck([
      ['container-service', 612],
      ['kubernetes', 401],
      ['function', 97],
      ['static-site', 30],
    ]),
    templates: deck([
      ['acme/node-service@3', 612],
      ['acme/node-service@4', 150],
      ['acme/go-service@2', 80],
      [null, 298],
    ]),
  };
}

export async function seedCatalog(
  ctx: SeedContext,
  teams: Map<string, Team>,
): Promise<Pick<World, 'domains' | 'groups' | 'apps' | 'appsByKey'>> {
  const at = ctx.now.getTime() - 365 * 86_400_000;
  const domains = DOMAINS.map((d, i) => ({
    id: uuidv7(ctx.rng, at + i),
    key: d.key,
    name: d.name,
  }));
  await insertMany(
    ctx.sql,
    'pipeline_domains',
    DOMAINS.map((d, i) => ({
      id: domains[i]?.id,
      key: d.key,
      name: d.name,
      color: d.color,
      position: i,
    })),
  );
  const groupIds = new Map<string, string>();
  const groups: World['groups'] = [];
  for (const [i, d] of DOMAINS.entries()) {
    for (const group of d.groups) {
      const id = uuidv7(ctx.rng, at + 100 + groups.length);
      groupIds.set(`${d.key}/${group.key}`, id);
      groups.push({ id, key: group.key, domainId: domains[i]?.id ?? '', domainKey: d.key });
    }
  }
  await insertMany(
    ctx.sql,
    'pipeline_groups',
    groups.map((group) => ({
      id: group.id,
      domain_id: group.domainId,
      key: group.key,
      name: DOMAINS.flatMap((d) => d.groups).find((s) => s.key === group.key)?.name ?? group.key,
    })),
  );

  const drafts = draftApps(ctx);
  const { runtimes, templates } = deal(ctx, drafts);
  const repos = new Map<string, { id: string; monorepo: boolean }>();
  const repoOf = (draft: Draft, index: number) => {
    const shared = !draft.repo && draft.group.count >= 4 && index % 3 === 0;
    const name = draft.repo ?? (shared ? `acme/${draft.group.key}-mono` : `acme/${draft.key}`);
    let repo = repos.get(name);
    if (!repo) {
      repo = {
        id: uuidv7(ctx.rng, at + 1000 + repos.size),
        monorepo: shared || name.endsWith('-mono'),
      };
      repos.set(name, repo);
    }
    return { name, ...repo };
  };
  const apps: AppInfo[] = [];
  const rows: Row[] = [];
  drafts.forEach((draft, index) => {
    const repo = repoOf(draft, index);
    const template = draft.start ? 'acme/node-service@3' : (templates[index] ?? null);
    const tier = draft.tier ?? 2;
    const team = draft.team ? (teams.get(draft.team) ?? null) : null;
    const roll = ctx.rng.next();
    const lifecycle = draft.start
      ? 'production'
      : roll < 0.04
        ? 'deprecated'
        : roll < 0.09
          ? 'experimental'
          : 'production';
    const language = template?.includes('go-') ? 'go' : template ? 'node' : ctx.rng.pick(LANGUAGES);
    const labels: string[] = [language];
    if (tier === 0 && ['commerce', 'finance'].includes(draft.domainKey)) labels.push('pci');
    if (draft.domainKey === 'identity') labels.push('gdpr');
    const id = uuidv7(ctx.rng, at + 5000 + index);
    const [major = ctx.rng.int(0, 8), minor = ctx.rng.int(0, 40), patch = 0] = draft.start ?? [];
    apps.push({
      id,
      key: draft.key,
      domainId: groups.find((g) => g.domainKey === draft.domainKey)?.domainId ?? '',
      domainKey: draft.domainKey,
      groupId: groupIds.get(`${draft.domainKey}/${draft.group.key}`) ?? '',
      groupKey: draft.group.key,
      ownerTeam: team,
      tier,
      ciMode: template ? (ctx.rng.chance(0.2) ? 'template' : 'runners') : 'external',
      repoId: repo.id,
      repoFullName: repo.name,
      weight: draft.key === 'gift-cards' ? 0 : (lifecycle === 'deprecated' ? 0.1 : 1) * (3 - tier),
      version: { major, minor, patch },
      steady: draft.start !== null,
    });
    const info = apps[apps.length - 1] as AppInfo;
    rows.push({
      id,
      key: draft.key,
      name: draft.key,
      domain_id: info.domainId,
      group_id: info.groupId,
      owner_team_id: team?.id ?? null,
      tier,
      labels,
      runtime: draft.start ? 'container-service' : (runtimes[index] ?? 'container-service'),
      lifecycle,
      ci_mode: info.ciMode,
      promotion_mode:
        tier === 2 ? 'continuous' : tier === 1 && ctx.rng.chance(0.3) ? 'train' : 'approval',
      repository_id: repo.id,
      path: repo.monorepo ? `services/${draft.key}` : '',
      template_ref: template,
    });
  });
  await insertMany(
    ctx.sql,
    'pipeline_repositories',
    [...repos.entries()].map(([name, repo]) => ({
      id: repo.id,
      provider: 'github',
      full_name: name,
      default_branch: 'main',
      url: `https://github.com/${name}`,
      monorepo: repo.monorepo,
    })),
  );
  await insertMany(ctx.sql, 'pipeline_applications', rows);
  ctx.log(
    `${domains.length} domains, ${groups.length} groups, ${repos.size} repositories, ${apps.length} applications`,
  );
  return { domains, groups, apps, appsByKey: new Map(apps.map((a) => [a.key, a])) };
}
