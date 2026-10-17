import type { SqlClient } from '@bemmoly/core';
import { evaluateCel, type CelInput } from './cel.ts';

/*
 * Does a policy (before or after a change) apply to any Tier 0 application? Then changing
 * it needs a second Platform admin (architecture §10.2, §20). Checked against every Tier 0
 * application in every environment, and against a bare Tier 0 application, so a selector
 * that only matches applications that do not exist yet is caught too. An expression that
 * cannot be evaluated counts as Tier 0: the rule fails closed.
 */

const CLASSES = ['dev', 'staging', 'prod'] as const;

function synthetic(): CelInput[] {
  return CLASSES.flatMap((cls) =>
    [true, false].map((protectedEnv) => ({
      application: {
        key: 'any',
        name: 'Any',
        tier: 0n,
        labels: [],
        lifecycle: 'production',
        runtime: 'container-service',
        domain: '',
        group: '',
        owner: '',
        has_owner: true,
      },
      env: { key: cls, class: cls, protected: protectedEnv, region: '' },
      action: 'deploy',
      requester: { id: '', teams: [], roles: [] },
      freeze: { active: false, name: '' },
    })),
  );
}

interface AppRow {
  key: string;
  name: string;
  labels: string[];
  lifecycle: string;
  runtime: string;
  domain: string;
  group: string;
  owner: string | null;
}

interface EnvRow {
  key: string;
  class: string;
  protected: boolean;
  region: string | null;
}

export async function appliesToTier0(sql: SqlClient, expressions: readonly string[]) {
  const [apps, envs] = await Promise.all([
    sql<AppRow[]>`
      select a.key, a.name, a.labels, a.lifecycle, a.runtime, d.key as domain, g.key as "group",
        t.name as owner
      from pipeline_applications a
        join pipeline_domains d on d.id = a.domain_id
        join pipeline_groups g on g.id = a.group_id
        left join teams t on t.id = a.owner_team_id
      where a.tier = 0 and a.archived_at is null
      order by a.key limit 500`,
    sql<EnvRow[]>`
      select key, class, coalesce((protection ->> 'protected')::boolean, class = 'prod') as protected,
        region
      from pipeline_environments where archived_at is null order by position limit 50`,
  ]);
  const inputs = synthetic();
  for (const app of apps) {
    for (const env of envs) {
      inputs.push({
        application: {
          key: app.key,
          name: app.name,
          tier: 0n,
          labels: app.labels,
          lifecycle: app.lifecycle,
          runtime: app.runtime,
          domain: app.domain,
          group: app.group,
          owner: app.owner ?? '',
          has_owner: app.owner !== null,
        },
        env: { key: env.key, class: env.class, protected: env.protected, region: env.region ?? '' },
        action: 'deploy',
        requester: { id: '', teams: [], roles: [] },
        freeze: { active: false, name: '' },
      });
    }
  }
  return expressions.some((expression) =>
    inputs.some((input) => {
      const result = evaluateCel(expression, input);
      return !result.ok || result.value;
    }),
  );
}
