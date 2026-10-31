import type { ShippingEngineDeps } from '../engine-deps.ts';
import { requestAutomatically, type RequestSettings } from './request.ts';

/*
 * Auto-promote (journeys proposal, "Continuous"): where a tier's path marks a step
 * auto-promote, each application's newest release goes there by itself. The first step goes
 * as soon as the release exists; a later one once the stage before it has the release
 * running for its bake time. Production is never promoted to this way, and the engine's
 * minute sweep runs this, so it works the same for releases from runners and from CI.
 */

/** Releases older than this are not caught up on when a step is newly marked auto-promote. */
const FRESH_HOURS = 24;

interface Due {
  release_id: string;
  environment_key: string;
}

async function dueSteps(deps: ShippingEngineDeps, limit: number): Promise<Due[]> {
  const now = deps.now().toISOString();
  return deps.sql<Due[]>`
    with steps as (
      select a.id as application_id, s.environment_id, e.key as environment_key, s.stage,
        s.path_id
      from pipeline_applications a
      join pipeline_environment_paths p on p.tier = a.tier
      join pipeline_environment_path_steps s on s.path_id = p.id and s.auto_promote
      join pipeline_environments e on e.id = s.environment_id
        and e.archived_at is null and e.class <> 'prod'
    ),
    newest as (
      select distinct on (application_id) id as release_id, application_id
      from pipeline_releases
      where created_at > ${now}::timestamptz - make_interval(hours => ${FRESH_HOURS})
      order by application_id, created_at desc, id desc
    )
    select n.release_id, st.environment_key
    from newest n join steps st on st.application_id = n.application_id
    where not exists (
        select 1 from pipeline_promotions pr
        where pr.release_id = n.release_id and pr.environment_id = st.environment_id)
      and (
        st.stage = (select min(f.stage) from pipeline_environment_path_steps f
          where f.path_id = st.path_id)
        or exists (
          select 1 from pipeline_deployments d
          join pipeline_environment_path_steps b
            on b.environment_id = d.environment_id and b.path_id = st.path_id
          where d.release_id = n.release_id and d.state = 'succeeded'
            and b.stage = (select max(e2.stage) from pipeline_environment_path_steps e2
              where e2.path_id = st.path_id and e2.stage < st.stage)
            and d.finished_at <= ${now}::timestamptz - make_interval(mins => b.bake_minutes))
      )
    order by n.release_id, st.environment_key
    limit ${limit}`;
}

/** Requests every promotion the paths say should start now; answers how many it asked for. */
export async function promoteAutomatically(
  deps: ShippingEngineDeps,
  settings: RequestSettings,
  limit = 50,
): Promise<number> {
  let requested = 0;
  for (const due of await dueSteps(deps, limit)) {
    try {
      const { created } = await requestAutomatically(
        deps,
        {
          release: due.release_id,
          to: due.environment_key,
          mode: 'continuous',
          note: 'Promoted automatically: this step of the path is set to auto-promote',
        },
        settings,
      );
      if (created) requested += 1;
    } catch {
      // A step the path cannot reach yet (or any more) is skipped; the next sweep looks again,
      // and a person can still promote by hand and see the reason there.
    }
  }
  return requested;
}
