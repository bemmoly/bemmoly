import type { RequestContext, SqlClient } from '@bemmoly/core';
import { ForbiddenError, NotFoundError, UnauthenticatedError } from '@bemmoly/shared';
import type { ForbiddenDetails, TraceStep } from '../../../../shared/access.ts';
import type { Release } from '../../../../shared/releases.ts';
import type { registerReleaseBodySchema } from '../../../../shared/releases.ts';
import { personOf } from '../deps.ts';
import type { AccessEngine } from '../access/engine.ts';
import type { CiPrincipal } from './principal.ts';
import { getRelease } from '../releases/read.ts';
import type { ReleaseWriter } from '../releases/write.ts';
import { trustDecision, type RuleFacts } from './trust.ts';

/*
 * POST /releases from Bring your CI (architecture §7.1). The caller is a CI system (its
 * OIDC token through a trust rule, or a scoped CI token) or a person (bp release create).
 * Every CI decision is stored with its trace, like any protected action.
 */

type RegisterBody = ReturnType<typeof registerReleaseBodySchema.parse>;

export interface RegisterInput {
  /** The person's context when the request carried a session or a Bemmoly token. */
  ctx: RequestContext | null;
  principal: CiPrincipal | null;
  body: RegisterBody;
}

interface AppRow {
  id: string;
  key: string;
  repository: string | null;
}

function refuse(sentence: string, trace: TraceStep[]): never {
  const details: ForbiddenDetails = {
    action: 'run',
    sentence,
    trace,
    askWho: null,
    scopeKind: 'application',
  };
  throw new ForbiddenError(sentence, { details });
}

/** A DSSE envelope or SLSA statement is kept with the release; its signature is not checked yet. */
function provenanceOf(attestation: string | undefined): Record<string, unknown> | null {
  if (!attestation) return null;
  let builder: string | null;
  try {
    const envelope = JSON.parse(attestation) as { payload?: string; predicate?: unknown };
    const statement = envelope.payload
      ? (JSON.parse(Buffer.from(envelope.payload, 'base64').toString('utf8')) as {
          predicate?: unknown;
        })
      : envelope;
    const predicate = statement.predicate as
      { builder?: { id?: string }; runDetails?: { builder?: { id?: string } } } | undefined;
    builder = predicate?.runDetails?.builder?.id ?? predicate?.builder?.id ?? null;
  } catch {
    builder = null;
  }
  return { kind: 'slsa', verified: false, builder, verifiedAt: null };
}

export async function registerRelease(
  deps: { sql: SqlClient; access: AccessEngine; writer: ReleaseWriter },
  input: RegisterInput,
): Promise<{ release: Release; created: boolean }> {
  const { sql } = deps;
  const { body } = input;
  const [app] = await sql<AppRow[]>`
    select a.id, a.key, r.full_name as repository from pipeline_applications a
      left join pipeline_repositories r on r.id = a.repository_id
    where a.key = ${body.application} and a.archived_at is null`;
  if (!app) throw new NotFoundError(`No application called "${body.application}"`);
  const principal = input.principal;
  let actor: { kind: string; id: string } | null = null;
  const trace: TraceStep[] = [];
  if (principal?.kind === 'token') {
    actor = { kind: 'ci_token', id: principal.tokenId };
    trace.push({ kind: 'binding', text: `CI token ${principal.name}`, effect: 'info', ref: null });
    if (!principal.applicationIds.includes(app.id)) {
      trace.push({
        kind: 'binding',
        text: `It is not scoped to ${app.key}`,
        effect: 'deny',
        ref: null,
      });
      await recordDecision(sql, actor, app.id, false, trace);
      refuse(`The CI token ${principal.name} cannot register releases for ${app.key}.`, trace);
    }
    trace.push({ kind: 'binding', text: `It is scoped to ${app.key}`, effect: 'grant', ref: null });
  } else if (principal?.kind === 'oidc') {
    const { facts, issuer } = principal;
    actor = { kind: 'ci_oidc', id: `${issuer.key}:${principal.subject}` };
    trace.push({
      kind: 'fact',
      text: `${issuer.name}: ${facts.repository ?? '?'} at ${facts.ref ?? '?'}${facts.workflow ? `, ${facts.workflow}` : ''}`,
      effect: 'info',
      ref: null,
    });
    const rules = await sql<RuleFacts[]>`
      select id, repository, refs, workflows, environments, application_ids as "applicationIds"
      from pipeline_ci_trust_rules where issuer_id = ${issuer.id}::uuid and enabled`;
    const decision = trustDecision(facts, rules, app);
    if (!decision.allowed) {
      trace.push({ kind: 'policy', text: decision.reason, effect: 'deny', ref: null });
      await recordDecision(sql, actor, app.id, false, trace);
      refuse(`${issuer.name} may not register releases for ${app.key}: ${decision.reason}.`, trace);
    }
    trace.push({
      kind: 'policy',
      text: 'A trust rule allows it',
      effect: 'grant',
      ref: { kind: 'trust_rule', id: decision.ruleId },
    });
    if (
      facts.sha &&
      !facts.sha.startsWith(body.commitSha) &&
      !body.commitSha.startsWith(facts.sha)
    ) {
      trace.push({
        kind: 'fact',
        text: `The token is for commit ${facts.sha.slice(0, 7)}`,
        effect: 'deny',
        ref: null,
      });
      await recordDecision(sql, actor, app.id, false, trace);
      refuse(
        `The token was issued for commit ${facts.sha.slice(0, 7)}, not ${body.commitSha.slice(0, 7)}.`,
        trace,
      );
    }
  } else if (input.ctx && personOf(input.ctx.actor)) {
    await deps.access.authorizeAction(input.ctx, 'run', { application: app.id }, { record: true });
  } else {
    throw new UnauthenticatedError('Sign in, or send your CI system’s OIDC token or a CI token');
  }
  if (actor) await recordDecision(sql, actor, app.id, true, trace);

  const images = body.images ?? (body.image ? { default: body.image } : {});
  const { tests } = body;
  return sql.begin(async (tx) => {
    const result = await deps.writer.createRelease(tx, {
      applicationId: app.id,
      version: body.version,
      source: 'external',
      commitSha: body.commitSha,
      ref: body.ref ?? null,
      imageRepository: body.imageRepository ?? null,
      imageDigests: images,
      testSummary: tests ?? null,
      provenance: provenanceOf(body.attestation),
      notes: body.notes ?? null,
      createdBy: input.ctx ? personOf(input.ctx.actor) : null,
      externalUrl: body.externalUrl ?? null,
    });
    return { release: await getRelease(tx, result.release.id), created: result.created };
  });
}

async function recordDecision(
  sql: SqlClient,
  actor: { kind: string; id: string },
  applicationId: string,
  allowed: boolean,
  trace: TraceStep[],
): Promise<void> {
  await sql`
    insert into pipeline_decisions (actor_kind, actor_id, action, application_id, allowed, trace)
    values (${actor.kind}, ${actor.id}, 'run', ${applicationId}::uuid, ${allowed},
      ${JSON.stringify({ sentence: allowed ? 'Release registered from CI' : 'Refused', trace })}::jsonb)`;
}
