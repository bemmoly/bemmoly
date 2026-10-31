import {
  APPROVAL_NOTIFICATION_KINDS,
  type ApprovalDecision,
  type ApprovalEventKind,
  type ApprovalEventPayload,
} from '@bemmoly/shared/approvals';
import { NOTIFICATION_EVENT_KINDS, type NotificationRequestedPayload } from '@bemmoly/shared';
import type { Actor } from '../../contracts/authz.ts';
import type { SqlExecutor } from '../../contracts/sql.ts';
import { userIdOf, type ApprovalDeps } from './context.ts';
import type { RequestRow } from './repository.ts';

/** What a step of the runtime does besides its own rows, all inside its transaction. */
export interface Effects {
  audit(action: string, row: RequestRow, after?: unknown): Promise<void>;
  emit(
    kind: ApprovalEventKind,
    row: RequestRow,
    decision?: ApprovalEventPayload['decision'],
  ): Promise<void>;
  askApprovers(row: RequestRow, approverIds: readonly string[], stage: number): Promise<void>;
  tellRequester(
    row: RequestRow,
    decision: ApprovalDecision | 'withdrawn',
    comment?: string | null,
  ): Promise<void>;
}

export function effectsFor(deps: ApprovalDeps, actor: Actor, tx: SqlExecutor): Effects {
  const notify = async (payload: NotificationRequestedPayload) =>
    deps.events.publish({
      kind: NOTIFICATION_EVENT_KINDS.notificationRequested,
      occurredAt: new Date(),
      actor,
      payload,
      transaction: tx,
    });
  const actorId = userIdOf(actor) ?? undefined;
  const target = (row: RequestRow) => ({
    kind: 'approval_request',
    id: row.id,
    label: row.title,
    ...(row.url ? { url: row.url } : {}),
  });

  return {
    async audit(action, row, after) {
      await deps.audit.record(
        {
          actor,
          action,
          target: { kind: 'approval_request', id: row.id },
          after: after ?? { status: row.status, stage: row.current_stage },
        },
        tx,
      );
    },
    async emit(kind, row, decision) {
      const payload: ApprovalEventPayload = {
        requestId: row.id,
        moduleId: row.module_id,
        workflowKey: row.workflow_key,
        subject: { kind: row.subject_kind, id: row.subject_id },
        requesterId: row.requester_id,
        status: row.status,
        stage: row.current_stage,
        ...(decision ? { decision } : {}),
      };
      await deps.events.publish({
        kind,
        occurredAt: new Date(),
        actor,
        entity: { kind: 'approval_request', id: row.id },
        payload,
        transaction: tx,
      });
    },
    async askApprovers(row, approverIds, stage) {
      if (approverIds.length === 0) return;
      await notify({
        kind: APPROVAL_NOTIFICATION_KINDS.requested,
        recipientIds: [...approverIds],
        ...(actorId ? { actorId } : {}),
        target: target(row),
        dedupeKey: `approval:${row.id}:${stage}:${approverIds.join(',')}`,
        data: { moduleId: row.module_id, stage },
      });
    },
    async tellRequester(row, decision, comment) {
      await notify({
        kind: APPROVAL_NOTIFICATION_KINDS.decided,
        recipientIds: [row.requester_id],
        ...(actorId ? { actorId } : {}),
        target: target(row),
        body: comment ?? '',
        dedupeKey: `approval:${row.id}:${decision}`,
        data: { moduleId: row.module_id, decision },
      });
    },
  };
}
