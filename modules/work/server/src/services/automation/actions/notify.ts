import {
  AUTOMATION_ACTIONS,
  notifyArgsSchema,
  type NotifyArgs,
} from '../../../../../shared/index.ts';
import type { ActionContext, ActionDefinition } from '../contract.ts';

async function recipientsOf(args: NotifyArgs, { ctx, issue, services }: ActionContext) {
  const ids = new Set(args.userIds);
  if (args.recipients.includes('assignee')) {
    for (const user of await services.issues.assignees(ctx, issue.key)) ids.add(user.id);
    if (issue.assigneeId) ids.add(issue.assigneeId);
  }
  if (args.recipients.includes('reporter') && issue.reporterId) ids.add(issue.reporterId);
  if (args.recipients.includes('watchers')) {
    for (const watcher of await services.issues.watchers(ctx, issue.key)) ids.add(watcher.userId);
  }
  return [...ids];
}

/** An inbox notification (and email, by each person's preference) about the issue. */
export const notify: ActionDefinition<NotifyArgs> = {
  name: AUTOMATION_ACTIONS.notify,
  label: 'Notify people',
  description:
    'Sends a notification about the issue to its assignees, reporter, watchers or people',
  params: notifyArgsSchema,
  async run(args, action) {
    const recipientIds = await recipientsOf(args, action);
    if (recipientIds.length === 0) return 'Nobody to notify';
    await action.services.notify(action.ctx, action.issue, {
      kind: 'watch_update',
      recipientIds,
      body: args.message,
      dedupeKey: `automation:${action.rule.id}:${action.issue.id}:${Date.now()}`,
    });
    return `Notified ${recipientIds.length} ${recipientIds.length === 1 ? 'person' : 'people'}`;
  },
};
