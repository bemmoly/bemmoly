import type { SqlClient } from '@bemmoly/core';
import { ValidationError } from '@bemmoly/shared';
import type { CopyApplication, CopySecretMode } from '../../../../shared/config-copy.ts';
import type { FlatDeploySettings } from '../../../../shared/deploy-settings.ts';
import { deploySettingsSchema } from '../../../../shared/deploy-settings.ts';
import { writeDeploySettings } from '../deploy-settings/store.ts';
import { recordChange } from '../history/record.ts';
import type { ProviderSourceOrRegistry } from '../shipping/engine-deps.ts';
import { resolveTarget as targetOf } from '../shipping/targets.ts';
import { environmentHome, homeOf, secretIdOf, storedVersion } from '../variables/home.ts';
import { upsertVariable } from '../variables/writes.ts';
import { resolveTarget, withCopied } from './plan.ts';
import type { CopyApplicationState, CopyEnvironment, CopyVariableRow } from './read.ts';

/*
 * Applying the ticked items of one application's copy. A secret copied store to store is
 * read from where the source keeps it, written as a new secret in the target's own project,
 * and granted to whoever the target's revisions run as. The value lives in this function's
 * memory for those calls and nowhere else: not in Postgres, a log or an event. The cloud
 * calls come first; Pipelines' rows then change in one transaction.
 */

export interface ApplyInput {
  app: CopyApplicationState;
  plan: CopyApplication;
  from: CopyEnvironment;
  to: CopyEnvironment;
  /** Ticked item ids, with the secret choice where one was made. */
  ticked: ReadonlyMap<string, CopySecretMode | undefined>;
  by: string | null;
}

interface SecretCopy {
  name: string;
  row: { ref: string | null; accountId: string | null; version: number };
  problem: string | null;
}

async function copySecret(
  sql: SqlClient,
  providers: ProviderSourceOrRegistry,
  input: ApplyInput,
  source: CopyVariableRow,
): Promise<SecretCopy['row']> {
  if (!source.secret_ref) throw new ValidationError(`${source.name} has no value to copy`);
  const from = await homeOf(sql, providers, source.secret_account_id);
  if (!from.secrets.accessVersion) {
    throw new ValidationError(
      `${source.name} cannot be read back to copy; leave it needing a value`,
    );
  }
  const to = await environmentHome(sql, providers, input.app.id, input.to.id);
  const ref = secretIdOf(input.app.key, input.to.key, source.name);
  const value = await from.secrets.accessVersion(from.connection, {
    account: from.account,
    name: source.secret_ref,
    version: String(source.version),
  });
  const { version } = await to.secrets.writeVersion(to.connection, {
    account: to.account,
    name: ref,
    value,
  });
  const { provider, target } = await targetOf(sql, providers, input.app.id, input.to.id);
  if (provider.adopt) {
    const principal = await provider.adopt.runtimePrincipal(target);
    await to.secrets.grantAccess(to.connection, { account: to.account, name: ref, principal });
  }
  return { ref, accountId: to.accountId, version: storedVersion(version) };
}

export async function applyApplication(
  sql: SqlClient,
  providers: ProviderSourceOrRegistry,
  input: ApplyInput,
): Promise<number> {
  const chosen = input.plan.items.filter(
    (item) => input.ticked.has(item.id) && (item.kind !== 'setting' || item.applies),
  );
  const settings: FlatDeploySettings = {};
  for (const item of chosen) {
    if (item.kind === 'setting' && item.applies && item.after !== null) {
      const source = input.app.from.settings;
      const [head = '', tail] = item.field.split('.');
      const top = (source as Record<string, unknown>)[head];
      const value = tail ? (top as Record<string, unknown> | undefined)?.[tail] : top;
      if (typeof value === 'number' || typeof value === 'string') settings[item.field] = value;
    }
  }
  const merged = deploySettingsSchema.parse(withCopied(input.app.to.settings, settings));
  const problem = resolveTarget(input.app, input.to, merged).problem;
  if (problem) throw new ValidationError(problem);

  const secrets: SecretCopy[] = [];
  for (const item of chosen) {
    if (item.kind !== 'secret') continue;
    const source = input.app.from.variables.find((row) => row.name === item.name);
    if (!source) continue;
    const mode = input.ticked.get(item.id) ?? item.mode;
    secrets.push(
      mode === 'copy'
        ? { name: item.name, row: await copySecret(sql, providers, input, source), problem: null }
        : {
            name: item.name,
            row: { ref: null, accountId: null, version: 0 },
            problem: `Copied from ${input.from.key} without its value: set one before deploying`,
          },
    );
  }

  await sql.begin(async (tx) => {
    const at = (name: string) => ({
      application: { id: input.app.id, key: input.app.key },
      environment: { id: input.to.id, key: input.to.key },
      name,
    });
    for (const item of chosen) {
      if (item.kind === 'variable') {
        await upsertVariable(tx, at(item.name), input.by, { kind: 'plain', value: item.after });
      }
    }
    for (const secret of secrets) {
      await upsertVariable(
        tx,
        at(secret.name),
        input.by,
        { kind: 'secret', ...secret.row },
        secret.problem,
      );
    }
    if (Object.keys(settings).length > 0) {
      await writeDeploySettings(tx, {
        applicationId: input.app.id,
        environmentId: input.to.id,
        settings: merged,
        by: input.by,
      });
    }
    const needed = secrets.filter((secret) => secret.problem).map((secret) => secret.name);
    await recordChange(tx, {
      kind: 'config',
      summary: `Copy · ${input.app.key} configuration from ${input.from.key} to ${input.to.key}`,
      detail: [
        `${chosen.length} items copied`,
        ...(needed.length > 0 ? [`${needed.join(', ')} still need a value`] : []),
      ].join('; '),
      applicationId: input.app.id,
      environmentId: input.to.id,
      actorUserId: input.by,
    });
  });
  return chosen.length;
}
