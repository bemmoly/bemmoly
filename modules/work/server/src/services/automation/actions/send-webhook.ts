import { WEBHOOK_REQUESTED_EVENT, type WebhookRequestedPayload } from '@bemmoly/shared/webhooks';
import {
  AUTOMATION_ACTIONS,
  sendWebhookArgsSchema,
  type SendWebhookArgs,
} from '../../../../../shared/index.ts';
import { issuePath } from '../../issues/notify.ts';
import type { ActionDefinition } from '../contract.ts';

/**
 * Asks the kernel for one delivery to an outgoing webhook an admin set up. The kernel signs,
 * sends, retries and logs it in Settings › Webhooks; a webhook that is off is skipped there.
 */
export const sendWebhook: ActionDefinition<SendWebhookArgs> = {
  name: AUTOMATION_ACTIONS.sendWebhook,
  label: 'Send a webhook',
  description: 'Sends the issue to one of the workspace’s outgoing webhooks',
  params: sendWebhookArgsSchema,
  async run(args, { ctx, issue, services, rule }) {
    const payload: WebhookRequestedPayload = {
      webhookId: args.webhookId,
      summary: `${rule.name}: ${issue.key} ${issue.title}`.slice(0, 500),
      url: issuePath(issue.key),
      data: {
        rule: { id: rule.id, name: rule.name },
        issue: {
          id: issue.id,
          key: issue.key,
          title: issue.title.slice(0, 200),
          projectId: issue.projectId,
          statusId: issue.statusId,
          priority: issue.priority,
          assigneeId: issue.assigneeId,
        },
      },
    };
    await services.events.publish({
      kind: WEBHOOK_REQUESTED_EVENT,
      occurredAt: new Date(),
      actor: ctx.actor,
      entity: { kind: 'issue', id: issue.id },
      payload,
    });
    return 'Queued a webhook delivery';
  },
};
