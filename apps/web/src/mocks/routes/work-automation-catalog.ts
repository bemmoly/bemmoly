/*
 * The automation registry's catalog as the server sends it: each trigger and
 * action with its arguments as JSON Schema. The mock checks a rule the way
 * the registry would refuse it, in the same words, without importing the
 * module (apps never do).
 */

const object = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: 'object',
  properties,
  required,
});
const text = { type: 'string' };
const list = (items: unknown) => ({ type: 'array', items });

const entry = (name: string, label: string, description: string, params = object({})) => ({
  name,
  label,
  description,
  params,
  available: true,
});

export const AUTOMATION_CATALOG = {
  triggers: [
    entry('issue_created', 'Issue created', 'When someone creates an issue'),
    entry(
      'field_changed',
      'Field changed',
      'When one of the chosen fields changes',
      object({ fields: list(text) }, ['fields']),
    ),
    entry(
      'issue_transitioned',
      'Issue transitioned',
      'When an issue moves between statuses',
      object({ fromStatus: text, toStatus: text }),
    ),
    entry('comment_added', 'Comment added', 'When someone comments on an issue'),
    entry(
      'scheduled',
      'On a schedule',
      'At set times, on every issue the conditions match',
      object({ cron: text }, ['cron']),
    ),
  ],
  actions: [
    entry(
      'set_field',
      'Set a field',
      'Write a value into a field',
      object({ field: text, value: {} }, ['field']),
    ),
    entry(
      'transition',
      'Move to a status',
      'Move the issue to a status',
      object({ status: text }, ['status']),
    ),
    entry(
      'assign',
      'Assign',
      'Assign the issue',
      object({ to: text, userId: { type: 'string', format: 'uuid' } }, ['to']),
    ),
    entry('add_comment', 'Add a comment', 'Comment on the issue', object({ body: text }, ['body'])),
    entry('add_label', 'Add a label', 'Add a label by name', object({ label: text }, ['label'])),
    entry(
      'send_webhook',
      'Send a webhook',
      'Send the issue to one of the workspace webhooks',
      object({ webhookId: { type: 'string', format: 'uuid' } }, ['webhookId']),
    ),
    entry(
      'notify',
      'Notify people',
      'Send an in-app notification',
      object({ recipients: list(text), userIds: list(text), message: text }, ['message']),
    ),
    entry(
      'archive',
      'Archive',
      'Archives the issue: off the board and lists, kept and still open by its key',
    ),
  ],
};

interface Problem {
  path: string;
  message: string;
}

type Entry = { name?: unknown; args?: Record<string, unknown> };

const blank = (value: unknown) => typeof value !== 'string' || value.trim() === '';

function actionProblem(action: Entry, index: number): Problem | null {
  const args = action.args ?? {};
  const at = (key: string, message: string) => ({ path: `actions.${index}.args.${key}`, message });
  if (action.name === 'transition' && blank(args['status'])) return at('status', 'Pick a status');
  if (action.name === 'add_label' && blank(args['label'])) return at('label', 'Pick a label');
  if (action.name === 'add_comment' && blank(args['body'])) return at('body', 'Write the comment');
  if (action.name === 'send_webhook' && blank(args['webhookId']))
    return at('webhookId', 'Pick a webhook');
  if (action.name === 'assign' && args['to'] === 'user' && blank(args['userId']))
    return at('userId', 'Pick the person to assign');
  if (action.name === 'notify' && blank(args['message'])) return at('message', 'Write the message');
  return null;
}

/** The first reason the server would refuse this rule, or null. */
export function ruleProblem(rule: Record<string, unknown>): Problem | null {
  if (blank(rule['name'])) return { path: 'name', message: 'Give the rule a name' };
  const trigger = (rule['trigger'] ?? {}) as Entry;
  const known = AUTOMATION_CATALOG.triggers.some((row) => row.name === trigger.name);
  if (!known) return { path: 'trigger.name', message: 'Pick a trigger' };
  const conditions = (rule['conditions'] as unknown[] | undefined) ?? [];
  if (trigger.name === 'scheduled' && conditions.length === 0)
    return { path: 'conditions', message: 'A scheduled rule needs at least one condition' };
  const actions = (rule['actions'] as Entry[] | undefined) ?? [];
  if (actions.length === 0) return { path: 'actions', message: 'Add at least one action' };
  for (const [index, action] of actions.entries()) {
    const problem = actionProblem(action, index);
    if (problem) return problem;
  }
  return null;
}
