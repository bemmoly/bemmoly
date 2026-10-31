import type { SqlExecutor } from '@bemmoly/core';
import {
  deploySettingsSchema,
  flattenDeploySettings,
  nestDeploySettings,
  type FlatDeploySettings,
} from '../../../../shared/deploy-settings.ts';
import { recordAddress } from '../deploy-settings/addresses.ts';
import { readDeploySettings, writeDeploySettings } from '../deploy-settings/store.ts';
import { recordChange } from '../history/record.ts';
import { recordDeploymentEvent } from '../shipping/record.ts';
import { upsertVariable } from '../variables/writes.ts';
import type { EnvironmentPlace } from './place.ts';
import type { CatalogApplication, PlannedService } from './plan.ts';

/*
 * Adopting one service, in the caller's transaction: its variables and secrets, its
 * settings, Cloud Run as its runtime there, and the image it runs as release zero, deployed
 * and current, so the first deploy from Pipelines rolls forward from it. Its address is
 * recorded as a deploy's would be, so references to it fill in at once.
 */

export interface AdoptOne {
  environment: EnvironmentPlace['environment'];
  application: CatalogApplication;
  planned: PlannedService;
  /** Plain variables whose address becomes a reference. */
  references: ReadonlySet<string>;
  /** Attached projects by their id in the cloud → their id in Pipelines. */
  accounts: ReadonlyMap<string, string>;
  place: EnvironmentPlace['place'];
  by: string | null;
  now: Date;
}

/** "0.0.0-adopted.staging": before any release Pipelines made, and unique per environment. */
export const releaseZeroVersion = (environment: string) =>
  `0.0.0-adopted.${environment}`.slice(0, 64);

async function importVariables(tx: SqlExecutor, input: AdoptOne) {
  const at = (name: string) => ({
    application: { id: input.application.id, key: input.application.key },
    environment: { id: input.environment.id, key: input.environment.key },
    name,
  });
  const planned = new Map(input.planned.view.variables.map((v) => [v.name, v]));
  for (const variable of input.planned.running.variables) {
    const view = planned.get(variable.name);
    if (!view) continue;
    if (variable.kind === 'plain' && view.kind === 'plain') {
      const value =
        view.reference && input.references.has(variable.name)
          ? view.reference.value
          : variable.value;
      await upsertVariable(tx, at(variable.name), input.by, { kind: 'plain', value });
    } else if (variable.kind === 'secret') {
      await upsertVariable(tx, at(variable.name), input.by, {
        kind: 'secret',
        ref: variable.secret,
        accountId: input.accounts.get(variable.account) ?? null,
        version: Number(variable.version),
      });
    }
  }
}

async function importSettings(tx: SqlExecutor, input: AdoptOne) {
  const existing = await readDeploySettings(tx, input.application.id, input.environment.id);
  const imported: FlatDeploySettings = Object.fromEntries(
    input.planned.view.settings.flatMap((entry) =>
      entry.value === null ? [] : [[entry.field, entry.value]],
    ),
  );
  const merged = deploySettingsSchema.parse(
    nestDeploySettings({ ...flattenDeploySettings(existing), ...imported }),
  );
  await writeDeploySettings(tx, {
    applicationId: input.application.id,
    environmentId: input.environment.id,
    settings: merged,
    by: input.by,
  });
}

/** It runs on Cloud Run there now, whatever the environment's default says. */
async function pinCloudRun(tx: SqlExecutor, input: AdoptOne) {
  const [row] = await tx<{ runtime: string }[]>`
    select coalesce(r.runtime, a.file_runtimes ->> e.key, e.default_runtime) as runtime
    from pipeline_applications a cross join pipeline_environments e
    left join pipeline_application_runtimes r
      on r.application_id = a.id and r.environment_id = e.id
    where a.id = ${input.application.id} and e.id = ${input.environment.id}`;
  if (row?.runtime === 'cloud-run') return;
  await tx`
    insert into pipeline_application_runtimes (application_id, environment_id, runtime, set_by)
    values (${input.application.id}, ${input.environment.id}, 'cloud-run', ${input.by})
    on conflict (application_id, environment_id) do update set
      runtime = 'cloud-run', set_by = excluded.set_by, updated_at = now()`;
}

export async function adoptService(
  tx: SqlExecutor,
  input: AdoptOne,
): Promise<{ id: string; version: string }> {
  const { running } = input.planned;
  const image = running.image;
  if (!image) throw new Error(`${running.name} has no image by digest`);
  await importVariables(tx, input);
  await importSettings(tx, input);
  await pinCloudRun(tx, input);
  const version = releaseZeroVersion(input.environment.key);
  const provenance = {
    adopted: {
      service: running.name,
      revision: running.revision,
      project: input.place.account,
      region: input.place.region,
    },
  };
  const [release] = await tx<{ id: string }[]>`
    insert into pipeline_releases
      (application_id, version, source, commit_sha, image_repository, image_digests,
       provenance, notes, created_by)
    values (${input.application.id}, ${version}, 'adopted', 'adopted', ${image.repository},
      ${JSON.stringify({ 'linux/amd64': image.digest })}::jsonb,
      ${JSON.stringify(provenance)}::jsonb,
      ${`Adopted from ${running.name} as it ran in ${input.environment.key}`}, ${input.by})
    returning id`;
  if (!release) throw new Error('release zero was not written');
  const [deployment] = await tx<{ id: string }[]>`
    insert into pipeline_deployments
      (release_id, application_id, environment_id, kind, state, revision, started_by, phase)
    values (${release.id}, ${input.application.id}, ${input.environment.id}, 'deploy',
      'pending', ${running.revision}, ${input.by}, 'done')
    returning id`;
  if (!deployment) throw new Error('release zero was not deployed');
  await recordDeploymentEvent(
    tx,
    deployment.id,
    {
      state: 'succeeded',
      message: `Adopted ${running.name} as it ran`,
      traffic: 100,
      phase: 'done',
      nextActionAt: null,
      ...(running.revision ? { revision: running.revision } : {}),
    },
    input.now,
  );
  await recordAddress(tx, {
    applicationId: input.application.id,
    environmentId: input.environment.id,
    runtime: 'cloud-run',
    address: { url: running.urls[0] ?? null, publicUrl: null },
  });
  const counts = input.planned.view;
  await recordChange(tx, {
    kind: 'config',
    summary: `Adopt · ${input.application.key} in ${input.environment.key} from Cloud Run`,
    detail: `${counts.variables.length} variables and ${counts.settings.length} settings imported; ${running.name} runs ${version} until the next deploy`,
    applicationId: input.application.id,
    environmentId: input.environment.id,
    actorUserId: input.by,
    ref: { kind: 'release', id: release.id },
    occurredAt: input.now,
  });
  return { id: release.id, version };
}
