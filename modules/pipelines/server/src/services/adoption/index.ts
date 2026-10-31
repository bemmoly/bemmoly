import type { RequestContext, SqlClient } from '@bemmoly/core';
import { ConflictError, NotFoundError, ValidationError } from '@bemmoly/shared';
import type { AdoptBody, AdoptionPlan, AdoptResult } from '../../../../shared/adoption.ts';
import {
  authorizePipelines,
  personOf,
  requireAccess,
  requireDatabase,
  type PipelinesServiceDeps,
} from '../deps.ts';
import type { ProviderSourceOrRegistry } from '../shipping/engine-deps.ts';
import { adoptService } from './apply.ts';
import { loadEnvironmentPlace, type EnvironmentPlace } from './place.ts';
import { planServices, type CatalogApplication, type PlannedService } from './plan.ts';

/*
 * Adopting an environment's services that already run (shared/adoption.ts). The plan reads
 * the cloud and changes nothing; adopting writes only to Pipelines. Looking needs `manage` in
 * the environment, since the plan shows the services' plain values; adopting needs `manage`
 * on each application there, and `deploy` too in a protected environment.
 */

export function createAdoptionService(
  deps: PipelinesServiceDeps & { providers: ProviderSourceOrRegistry; now?: () => Date },
) {
  const sql = (): SqlClient => requireDatabase(deps);
  const now = deps.now ?? (() => new Date());

  async function look(ctx: RequestContext, key: string) {
    await authorizePipelines(ctx);
    const where = await loadEnvironmentPlace(sql(), deps.providers, key);
    await requireAccess(deps).authorizeAction(ctx, 'manage', {
      environment: where.environment.id,
    });
    return where;
  }

  async function plan(where: EnvironmentPlace, chosen?: ReadonlyMap<string, string>) {
    const running = await where.adopt.listServices(where.connection, where.place);
    const catalog = await sql()<CatalogApplication[]>`
      select id, key, name from pipeline_applications where archived_at is null order by key`;
    const states = await sql()<{ application_id: string; adopted: boolean }[]>`
      select d.application_id, bool_or(r.source = 'adopted') as adopted
      from pipeline_deployments d join pipeline_releases r on r.id = d.release_id
      where d.environment_id = ${where.environment.id} and d.revision is not null
      group by d.application_id`;
    const accounts = await sql()<{ id: string; external_id: string }[]>`
      select id, external_id from cloud_accounts where connection_id = ${where.connection.id}`;
    const accountIds = new Map(accounts.map((row) => [row.external_id, row.id]));
    const planned = planServices({
      running,
      catalog,
      states: new Map(
        states.map((row) => [row.application_id, row.adopted ? 'adopted' : 'deployed'] as const),
      ),
      accounts: accountIds,
      ...(chosen ? { chosen } : {}),
    });
    const view: AdoptionPlan = {
      environment: {
        id: where.environment.id,
        key: where.environment.key,
        name: where.environment.name,
        class: where.environment.class,
      },
      project: where.place.account,
      region: where.place.region,
      services: planned.map((service) => service.view),
      applications: catalog.map(({ key, name }) => ({ key, name })),
    };
    return { planned, view, accounts: accountIds };
  }

  function adoptable(planned: PlannedService, environment: string): CatalogApplication {
    const { view, application } = planned;
    if (!application) throw new NotFoundError(`No application is called ${view.service}`);
    if (view.state === 'adopted') {
      throw new ConflictError(`${view.service} is adopted in ${environment} already`);
    }
    if (view.state === 'deployed') {
      throw new ConflictError(
        `Pipelines already deploys ${application.key} to ${environment}, so there is nothing to adopt`,
      );
    }
    const secret = view.variables.find((v) => v.kind === 'secret' && v.problem);
    const problem = view.problem ?? (secret?.kind === 'secret' ? secret.problem : null);
    if (problem) throw new ValidationError(problem);
    return application;
  }

  return {
    async plan(ctx: RequestContext, key: string): Promise<AdoptionPlan> {
      return (await plan(await look(ctx, key))).view;
    },

    async adopt(ctx: RequestContext, key: string, body: AdoptBody): Promise<AdoptResult> {
      const where = await look(ctx, key);
      const chosen = new Map(body.services.map((item) => [item.service, item.application]));
      if (new Set(chosen.values()).size !== chosen.size) {
        throw new ValidationError('Each application can adopt one service; choose one for each');
      }
      const { planned, accounts } = await plan(where, chosen);
      const access = requireAccess(deps);
      const work = body.services.map((item) => {
        const found = planned.find((service) => service.view.service === item.service);
        if (!found) {
          throw new NotFoundError(`No Cloud Run service is called ${item.service} in ${key}`);
        }
        return { item, found, application: adoptable(found, key) };
      });
      const live = new Set([
        ...work.map(({ application }) => application.key),
        ...planned.flatMap(({ view }) =>
          view.application && (view.state === 'adopted' || view.state === 'deployed')
            ? [view.application.key]
            : [],
        ),
      ]);
      for (const { item, found } of work) {
        for (const name of item.references ?? []) {
          const variable = found.view.variables.find((v) => v.name === name);
          const reference = variable?.kind === 'plain' ? variable.reference : null;
          if (!reference) {
            throw new ValidationError(
              `${name} on ${item.service} holds no other service's address`,
            );
          }
          if (!live.has(reference.application)) {
            throw new ValidationError(
              `${name} names ${reference.application}, which is not adopted in ${key}. Adopt ${reference.application} too, or keep the address as it is`,
            );
          }
        }
      }
      for (const { application } of work) {
        const target = { application: application.id, environment: where.environment.id };
        await access.authorizeAction(ctx, 'manage', target, { record: true });
        if (where.environment.protected) {
          await access.authorizeAction(ctx, 'deploy', target, { record: true });
        }
      }
      const by = personOf(ctx.actor);
      const adopted = await sql().begin(async (tx) => {
        const done: AdoptResult['adopted'] = [];
        for (const { item, found, application } of work) {
          const release = await adoptService(tx, {
            environment: where.environment,
            application,
            planned: found,
            references: new Set(item.references ?? []),
            accounts,
            place: where.place,
            by,
            now: now(),
          });
          done.push({ service: item.service, application: application.key, release });
        }
        return done;
      });
      return { adopted, plan: (await plan(where)).view };
    },
  };
}

export type AdoptionService = ReturnType<typeof createAdoptionService>;
