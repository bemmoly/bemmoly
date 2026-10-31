import { ConflictError, ForbiddenError } from '@bemmoly/shared';
import {
  decideApprovalBodySchema,
  startApprovalInputSchema,
  withdrawApprovalBodySchema,
  type ApprovalRequest,
  type DecideApprovalBody,
  type StartApprovalInput,
  type WithdrawApprovalBody,
} from '@bemmoly/shared/approvals';
import type { Actor } from '../../contracts/authz.ts';
import { allHold } from './conditions.ts';
import { nowOf, userIdOf, type ApprovalDeps } from './context.ts';
import { currentVersion } from './definitions.ts';
import { effectsFor } from './effects.ts';
import { isOpen, loadRequest, toRequest, type RequestRow } from './repository.ts';
import { close, openStage } from './stages.ts';

/**
 * Only a signed-in person decides or withdraws: a token, an AI plan or a rule may be limited to
 * other modules, and an approval is a person's judgement, never delegated to a credential.
 */
function personOf(actor: Actor): string {
  const id = actor.kind === 'user' ? userIdOf(actor) : null;
  if (!id) throw new ForbiddenError('Approvals are requested and decided by people');
  return id;
}

/** Start, decide and withdraw: each one transaction, with its audit rows, events and notices. */
export function createRuntime(deps: ApprovalDeps) {
  const { sql } = deps;
  const reload = async (id: string) => toRequest(await loadRequest(sql, id));

  return {
    async start(actor: Actor, input: StartApprovalInput): Promise<ApprovalRequest> {
      const requesterId = personOf(actor);
      const body = startApprovalInputSchema.parse(input);
      const id = await sql.begin(async (tx) => {
        const version = await currentVersion(tx, body.moduleId, body.workflowKey);
        const [open] = await tx<{ id: string }[]>`
          select id from approval_requests
          where module_id = ${body.moduleId} and workflow_key = ${body.workflowKey}
            and subject_kind = ${body.subject.kind} and subject_id = ${body.subject.id}
            and status in ('pending', 'escalated')
          limit 1`;
        if (open) throw new ConflictError('This already has an open approval request');
        const [row] = await tx<RequestRow[]>`
          insert into approval_requests (workflow_version_id, module_id, workflow_key,
            subject_kind, subject_id, title, url, requester_id, fields)
          values (${version.versionId}, ${body.moduleId}, ${body.workflowKey},
            ${body.subject.kind}, ${body.subject.id}, ${body.title}, ${body.url ?? null},
            ${requesterId}, ${JSON.stringify(body.fields)}::jsonb)
          returning *`;
        const fx = effectsFor(deps, actor, tx);
        await fx.audit('approval.requested', row!, {
          workflowKey: body.workflowKey,
          version: version.version,
          fields: body.fields,
        });
        await fx.emit('approval.requested', row!);
        if (version.spec.autoApprove.some((group) => allHold(group, body.fields))) {
          const approved = await close(deps, tx, row!, 'approved', true);
          await fx.audit('approval.approved', approved, { status: 'approved', auto: true });
          await fx.emit('approval.approved', approved);
          await fx.tellRequester(approved, 'approve');
          return approved.id;
        }
        return (await openStage(deps, tx, fx, row!, version.spec, 0)).id;
      });
      return reload(id as string);
    },

    async decide(actor: Actor, id: string, input: DecideApprovalBody): Promise<ApprovalRequest> {
      const approverId = personOf(actor);
      const body = decideApprovalBodySchema.parse(input);
      await sql.begin(async (tx) => {
        const { row, spec, tasks } = await loadRequest(tx, id, true);
        if (!isOpen(row.status)) throw new ConflictError('This request is already closed');
        const task = tasks.find(
          (t) =>
            t.approver_id === approverId && t.status === 'pending' && t.stage === row.current_stage,
        );
        if (!task) throw new ForbiddenError('This request is not waiting on you');
        const now = nowOf(deps);
        const status = body.decision === 'approve' ? 'approved' : 'rejected';
        await tx`
          update approval_tasks set status = ${status}, comment = ${body.comment ?? null},
            decided_at = ${now.toISOString()}, updated_at = ${now.toISOString()}
          where id = ${task.id}`;
        const fx = effectsFor(deps, actor, tx);
        const decision = { approverId, decision: body.decision, comment: body.comment ?? null };
        await fx.audit('approval.decided', row, {
          taskId: task.id,
          stage: task.stage,
          ...decision,
        });
        await fx.emit('approval.decided', row, decision);
        if (body.decision === 'reject') {
          const rejected = await close(deps, tx, row, 'rejected');
          await fx.audit('approval.rejected', rejected);
          await fx.emit('approval.rejected', rejected);
          await fx.tellRequester(rejected, 'reject', body.comment);
          return;
        }
        const stage = spec.stages[task.stage]!;
        const others = tasks.filter(
          (t) =>
            t.stage === task.stage && t.id !== task.id && !t.escalation && t.status !== 'cancelled',
        );
        // An escalation approver was asked because the stage stalled, so they decide it alone.
        const done =
          stage.mode === 'any' || task.escalation || others.every((t) => t.status === 'approved');
        if (!done) return;
        await tx`
          update approval_tasks set status = 'cancelled', updated_at = ${now.toISOString()}
          where request_id = ${row.id} and stage = ${task.stage} and status = 'pending'`;
        await openStage(deps, tx, fx, row, spec, task.stage + 1);
      });
      return reload(id);
    },

    async withdraw(
      actor: Actor,
      id: string,
      input: WithdrawApprovalBody = {},
    ): Promise<ApprovalRequest> {
      const requesterId = personOf(actor);
      const body = withdrawApprovalBodySchema.parse(input);
      await sql.begin(async (tx) => {
        const { row } = await loadRequest(tx, id, true);
        if (row.requester_id !== requesterId) {
          throw new ForbiddenError('Only the requester can withdraw a request');
        }
        if (!isOpen(row.status)) throw new ConflictError('This request is already closed');
        const withdrawn = await close(deps, tx, row, 'withdrawn');
        const fx = effectsFor(deps, actor, tx);
        await fx.audit('approval.withdrawn', withdrawn, {
          status: 'withdrawn',
          comment: body.comment ?? null,
        });
        await fx.emit('approval.withdrawn', withdrawn);
      });
      return reload(id);
    },
  };
}
