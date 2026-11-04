import type { RequestContext } from '@bemmoly/core';
import { ValidationError } from '@bemmoly/shared';
import type { z } from 'zod';
import type {
  CloudAccessCheckResponse,
  cloudAccessCheckBodySchema,
  ReachableProject,
} from '../../../../shared/cloud-reach.ts';
import type { ConnectionRow } from '../../models/clouds.ts';
import type { CloudProvider, ConnectionRecord } from '../providers/contract.ts';
import { recordAccountCheck, upsertAttached } from './accounts.ts';
import { providerFor, type ConnectionsDeps } from './connections.ts';
import { credentialsOf, recordCheck, toRecord } from './store.ts';

/*
 * What Bemmoly can reach (product rule 9): "Check access" signs in the way the person chose and
 * lists every project their reach covers, with what each is missing, before anything is
 * stored. With `managed` it checks the folder and billing grants bootstrap.sh made instead of
 * projects, since a folder made for Pipelines starts empty. Connecting then records those
 * projects as attached: it reads them and never creates or changes anything in the cloud.
 */

type AccessCheckBody = z.infer<typeof cloudAccessCheckBodySchema>;

/** Checks run a few at a time, so a folder of many projects does not flood the cloud. */
const AT_ONCE = 5;

async function inBatches<T, R>(items: readonly T[], work: (item: T) => Promise<R>) {
  const out: R[] = [];
  for (let start = 0; start < items.length; start += AT_ONCE) {
    out.push(...(await Promise.all(items.slice(start, start + AT_ONCE).map(work))));
  }
  return out;
}

async function checkProjects(
  provider: CloudProvider,
  record: ConnectionRecord,
): Promise<ReachableProject[]> {
  const part = provider.connection;
  if (!part?.listReachable || !part.verifyAccount) {
    throw new ValidationError(`${provider.name} cannot list projects yet`);
  }
  const reachable = await part.listReachable(record);
  return inBatches(reachable.slice(0, 100), async (account) => {
    const check = await part.verifyAccount!(record, { externalId: account.externalId, config: {} });
    const ok = check.ok;
    return {
      externalId: account.externalId,
      name: check.name ?? account.name,
      ok,
      services: check.services ?? { run: ok, build: ok, secrets: ok },
      problems: check.problems,
    };
  });
}

export function createReach(deps: ConnectionsDeps) {
  return {
    async accessCheck(
      ctx: RequestContext,
      body: AccessCheckBody,
    ): Promise<CloudAccessCheckResponse> {
      await deps.authorizeAdmin(ctx);
      const provider = await providerFor(deps.providers, body.provider);
      if (!provider.connection) throw new ValidationError(`${provider.name} is coming soon`);
      // Held in memory only: checking stores nothing.
      const record: ConnectionRecord = {
        id: 'access-check',
        provider: body.provider,
        name: 'Google Cloud',
        layout: 'per-environment',
        boundaryRef: null,
        config: {
          mode: 'attached',
          region: 'us-central1',
          credentials: credentialsOf({
            signIn: body.signIn,
            ...(body.credentialFile ? { credentialFile: body.credentialFile } : {}),
          }),
          ...(body.reach ? { reach: body.reach } : {}),
        },
      };
      const signIn = await provider.connection.verify(record);
      if (signIn.ok && body.managed) {
        const grants = await provider.connection.verify({
          ...record,
          config: { ...record.config, mode: 'managed', ...body.managed },
        });
        return {
          signedIn: true,
          principal: grants.principal ?? signIn.principal,
          problems: grants.problems,
          projects: [],
        };
      }
      if (!signIn.ok || !body.reach) {
        return {
          signedIn: signIn.ok,
          principal: signIn.principal,
          problems: signIn.problems,
          projects: [],
        };
      }
      return {
        signedIn: true,
        principal: signIn.principal,
        problems: [],
        projects: await checkProjects(provider, record),
      };
    },
  };
}

/** After connecting with a reach: record each project found there as attached and checked. */
export async function attachReachable(
  deps: ConnectionsDeps,
  row: ConnectionRow,
): Promise<ConnectionRow> {
  if (!row.config['reach'] || row.config['mode'] !== 'attached') return row;
  const provider = await providerFor(deps.providers, row.provider as CloudProvider['id']);
  if (!provider.connection) return row;
  const record = toRecord(row);
  const signIn = await provider.connection.verify(record);
  const checked = await recordCheck(deps.sql(), row.id, signIn);
  if (!signIn.ok) return checked;
  for (const project of await checkProjects(provider, record)) {
    const accountId = await upsertAttached(deps.sql(), row.id, {
      externalId: project.externalId,
      name: project.name ?? project.externalId,
      config: { deployerServiceAccount: null, runtimeServiceAccount: null },
    });
    await recordAccountCheck(deps.sql(), accountId, project, false);
  }
  return checked;
}
