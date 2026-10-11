import { z } from 'zod';
import { lqlQuerySchema } from './filters.ts';

/*
 * The arguments of every built-in trigger and action, shared so the rule
 * builder and the registry agree. A status or a label is named, not an id:
 * a global rule runs in every project, and each project has its own.
 */

export const AUTOMATION_TRIGGERS = {
  issueCreated: 'issue_created',
  fieldChanged: 'field_changed',
  issueTransitioned: 'issue_transitioned',
  commentAdded: 'comment_added',
  scheduled: 'scheduled',
} as const;

export const AUTOMATION_ACTIONS = {
  setField: 'set_field',
  transition: 'transition',
  assign: 'assign',
  addComment: 'add_comment',
  addLabel: 'add_label',
  sendWebhook: 'send_webhook',
  notify: 'notify',
} as const;

/** Fields a change can be watched on, as the issue history names them. */
export const AUTOMATION_WATCHED_FIELDS = [
  'title',
  'description',
  'priority',
  'assigneeId',
  'sprintId',
  'estimate',
  'dueAt',
  'labelIds',
  'typeId',
  'parentId',
  'fixVersionId',
  'componentId',
] as const;

const CUSTOM_FIELD = /^customFields\.[a-z][a-z0-9_]{0,63}$/;

export const watchedFieldSchema = z.union([
  z.enum(AUTOMATION_WATCHED_FIELDS),
  z.string().regex(CUSTOM_FIELD, 'Custom fields look like "customFields.<key>"'),
]);

const statusNameSchema = z.string().trim().min(1).max(60);

export const issueCreatedArgsSchema = z.object({});

export const fieldChangedArgsSchema = z.object({
  fields: z.array(watchedFieldSchema).min(1, 'Pick at least one field').max(20),
});

export const issueTransitionedArgsSchema = z.object({
  /** Status names, matched without case; absent matches any. */
  fromStatus: statusNameSchema.optional(),
  toStatus: statusNameSchema.optional(),
});

export const commentAddedArgsSchema = z.object({});

/** Five-field cron, in UTC; a scheduled rule acts on the issues its conditions match. */
export const scheduledArgsSchema = z.object({
  cron: z
    .string()
    .trim()
    .regex(/^(\S+\s+){4}\S+$/, 'Use a five-field cron expression, e.g. "0 9 * * 1"'),
});

/** Fields the set-field action writes; custom fields by key. */
export const AUTOMATION_SETTABLE_FIELDS = ['priority', 'estimate', 'dueAt', 'title'] as const;

export const setFieldArgsSchema = z.object({
  field: z.union([
    z.enum(AUTOMATION_SETTABLE_FIELDS),
    z.string().regex(CUSTOM_FIELD, 'Custom fields look like "customFields.<key>"'),
  ]),
  value: z.unknown(),
});

export const transitionArgsSchema = z.object({ status: statusNameSchema });

export const ASSIGN_TARGETS = ['user', 'reporter', 'trigger_actor', 'unassigned'] as const;

export const assignArgsSchema = z
  .object({ to: z.enum(ASSIGN_TARGETS), userId: z.uuid().optional() })
  .refine((args) => args.to !== 'user' || args.userId !== undefined, {
    message: 'Pick the person to assign',
    path: ['userId'],
  });

export const addCommentArgsSchema = z.object({ body: z.string().trim().min(1).max(5000) });

export const addLabelArgsSchema = z.object({ label: z.string().trim().min(1).max(60) });

export const sendWebhookArgsSchema = z.object({ webhookId: z.uuid() });

export const NOTIFY_RECIPIENTS = ['assignee', 'reporter', 'watchers'] as const;

export const notifyArgsSchema = z
  .object({
    recipients: z.array(z.enum(NOTIFY_RECIPIENTS)).max(3).default([]),
    userIds: z.array(z.uuid()).max(50).default([]),
    message: z.string().trim().min(1).max(500),
  })
  .refine((args) => args.recipients.length + args.userIds.length > 0, {
    message: 'Pick who to notify',
    path: ['recipients'],
  });

/** Scheduled rules need a filter: without one they would act on every issue. */
export const scheduledConditionsSchema = z.array(lqlQuerySchema).min(1);

export type FieldChangedArgs = z.infer<typeof fieldChangedArgsSchema>;
export type IssueTransitionedArgs = z.infer<typeof issueTransitionedArgsSchema>;
export type ScheduledArgs = z.infer<typeof scheduledArgsSchema>;
export type SetFieldArgs = z.infer<typeof setFieldArgsSchema>;
export type TransitionArgs = z.infer<typeof transitionArgsSchema>;
export type AssignArgs = z.infer<typeof assignArgsSchema>;
export type AddCommentArgs = z.infer<typeof addCommentArgsSchema>;
export type AddLabelArgs = z.infer<typeof addLabelArgsSchema>;
export type SendWebhookArgs = z.infer<typeof sendWebhookArgsSchema>;
export type NotifyArgs = z.infer<typeof notifyArgsSchema>;
