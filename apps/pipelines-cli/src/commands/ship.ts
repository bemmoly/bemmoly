import { connect, parse, SERVER_FLAGS, type Context } from '../cli/context.ts';
import { CliError, usageError } from '../cli/errors.ts';
import type { PipelinesClient } from '../clients/pipelines.ts';

/*
 * bp promote asks for a release to move to an environment (policy decides what it then
 * waits for); bp rollback puts an environment back on the release it ran before. Both are
 * the same requests the Promote screen and the roll back button send.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A release id, a version of the application, or (with nothing named) its newest release. */
async function releaseOf(client: PipelinesClient, application: string, wanted: string | undefined) {
  if (wanted && UUID.test(wanted)) return { id: wanted, version: wanted };
  const page = await client.releases({ application, ...(wanted ? { q: wanted } : {}), limit: 20 });
  const release = wanted ? page.items.find((item) => item.version === wanted) : page.items[0];
  if (!release) {
    throw new CliError(
      wanted
        ? `${application} has no release ${wanted}.`
        : `${application} has no releases yet. Register one with "bp release create".`,
    );
  }
  return { id: release.id, version: release.version };
}

export async function promoteCommand(ctx: Context, argv: readonly string[]): Promise<number> {
  const { values, positionals } = parse(argv, {
    ...SERVER_FLAGS,
    to: { type: 'string' },
    release: { type: 'string' },
    note: { type: 'string' },
  });
  const application = positionals[0];
  if (!application || !values.to)
    throw usageError('Use: bp promote <application> --to <environment>');
  const { client } = await connect(ctx, values);
  const release = await releaseOf(client, application, values.release);
  const promotion = await client.promote({
    release: release.id,
    to: values.to,
    ...(values.note ? { note: values.note } : {}),
  });
  ctx.output.out(
    `Promotion of ${application} ${promotion.release.version} to ${promotion.environment.name}: ${promotion.state.replaceAll('_', ' ')}.`,
  );
  for (const requirement of promotion.requirements) {
    ctx.output.out(
      `  ${requirement.label}: ${requirement.have} of ${requirement.needed} approvals`,
    );
  }
  for (const gate of promotion.gates.filter((item) => item.state !== 'pass')) {
    ctx.output.out(`  ${gate.label}: ${gate.state}, ${gate.reason}`);
  }
  ctx.output.out(`Promotion id: ${promotion.id}`);
  return 0;
}

export async function rollbackCommand(ctx: Context, argv: readonly string[]): Promise<number> {
  const { values, positionals } = parse(argv, {
    ...SERVER_FLAGS,
    env: { type: 'string' },
    to: { type: 'string' },
    reason: { type: 'string' },
  });
  const application = positionals[0];
  if (!application || !values.env)
    throw usageError('Use: bp rollback <application> --env <environment>');
  const { client } = await connect(ctx, values);
  const page = await client.deployments({ application, environment: values.env, limit: 1 });
  const current = page.items[0];
  if (!current) throw new CliError(`${application} has never been deployed to ${values.env}.`);
  const toRelease = values.to ? (await releaseOf(client, application, values.to)).id : undefined;
  const rollback = await client.rollback(current.id, {
    ...(values.reason ? { reason: values.reason } : {}),
    ...(toRelease ? { toRelease } : {}),
  });
  ctx.output.out(
    `Rolling back ${application} in ${rollback.environment.name} to ${rollback.release.version}: ${rollback.state}.`,
  );
  return 0;
}
