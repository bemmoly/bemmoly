import type { World } from './world.ts';

/*
 * Bring your CI for the demo: GitHub Actions trusted (the changeset adds it; a reset empties
 * it), and trust rules for the repositories whose applications build in their own CI, so
 * Platform › CI has something to show and a workflow from those repositories could register.
 */

export async function seedCi(world: World): Promise<void> {
  const { sql } = world;
  await sql`
    insert into pipeline_ci_issuers (key, name, kind, issuer, discovery_url)
    values ('github-actions', 'GitHub Actions', 'github',
      'https://token.actions.githubusercontent.com',
      'https://token.actions.githubusercontent.com/.well-known/openid-configuration')
    on conflict do nothing`;
  const rows = await sql<{ count: number }[]>`
    insert into pipeline_ci_trust_rules (issuer_id, repository, refs, workflows)
    select i.id, r.full_name, '{main,refs/tags/v*}', '{}'
    from pipeline_ci_issuers i,
      (select distinct p.full_name from pipeline_applications a
        join pipeline_repositories p on p.id = a.repository_id
        where a.ci_mode = 'external' order by p.full_name limit 12) r
    where i.key = 'github-actions'
    returning 1 as count`;
  world.log(`${rows.length} CI trust rules for GitHub Actions`);
}
