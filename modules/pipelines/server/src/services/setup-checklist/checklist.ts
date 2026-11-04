import type { SqlExecutor } from '@bemmoly/core';
import {
  versionSchemeSchema,
  type SetupChecklistResponse,
  type SetupStep,
  type SetupStepKey,
} from '../../../../shared/pipeline-setup.ts';

/*
 * The fresh-install checklist (product rule 2), read from what each area stored: nothing here
 * is a flag someone ticks. A step is done when its records exist, so a step done from any
 * screen, in any order, shows as done; steps that need another say which.
 */

interface Facts {
  clouds: string[];
  environments: number;
  people: number;
  services: number;
  pipelines: number;
  templates: number;
  on_push: boolean;
  schemes: string[];
}

async function factsOf(sql: SqlExecutor): Promise<Facts> {
  const [row] = await sql<Facts[]>`
    select
      coalesce((select array_agg(distinct p.name) from cloud_connections c
        join (values ('gcp', 'Google Cloud'), ('aws', 'Amazon Web Services'),
          ('azure', 'Microsoft Azure'), ('kubernetes', 'Kubernetes'), ('local', 'This machine'))
          as p(provider, name) on p.provider = c.provider
        where c.status = 'connected'), '{}') as clouds,
      (select count(*)::int from pipeline_environments where archived_at is null) as environments,
      -- Anyone given a role or put in a group, besides the organisation admins who are
      -- Platform admins already, or a team given a role.
      ((select count(distinct p.user_id)::int from (
          select subject_id as user_id from pipeline_role_bindings
            where subject_kind = 'user' and scope_kind = 'organisation'
          union select user_id from pipeline_approval_group_members) p
        join users u on u.id = p.user_id
        left join roles r on r.id = u.role_id
        where r.key is distinct from 'org_admin')
       + (select count(*)::int from pipeline_role_bindings where subject_kind = 'team')) as people,
      (select count(*)::int from pipeline_applications where archived_at is null) as services,
      (select count(*)::int from pipeline_applications
        where archived_at is null and pipeline_start is not null) as pipelines,
      (select count(*)::int from pipeline_templates) as templates,
      exists (select 1 from pipeline_applications, jsonb_array_elements(pipeline_triggers) t
        where archived_at is null and t ->> 'kind' = 'push') as on_push,
      coalesce((select array_agg(distinct version_scheme) from pipeline_applications
        where archived_at is null and version_scheme is not null), '{}') as schemes`;
  if (!row) throw new Error('the checklist read returned nothing');
  return row;
}

export async function readChecklist(sql: SqlExecutor): Promise<SetupChecklistResponse> {
  const facts = await factsOf(sql);
  const done: Record<SetupStepKey, boolean> = {
    cloud: facts.clouds.length > 0,
    environments: facts.environments > 0,
    people: facts.people > 0,
    services: facts.services > 0,
    pipelines: facts.pipelines > 0,
    templates: facts.templates > 0,
  };
  const step = (
    key: SetupStepKey,
    optional: boolean,
    needs: SetupStepKey | null = null,
  ): SetupStep => ({
    key,
    done: done[key],
    optional,
    blockedBy: needs && !done[needs] && !done[key] ? needs : null,
  });
  const steps = [
    step('cloud', false),
    step('environments', false, 'cloud'),
    step('people', true),
    step('services', false),
    step('pipelines', false, 'services'),
    step('templates', true),
  ];
  return {
    steps,
    complete: steps.every((item) => item.optional || item.done),
    switchedOn: {
      clouds: facts.clouds,
      deployOnPush: facts.on_push,
      versionSchemes: facts.schemes.flatMap((scheme) => {
        const parsed = versionSchemeSchema.safeParse(scheme);
        return parsed.success ? [parsed.data] : [];
      }),
    },
  };
}
