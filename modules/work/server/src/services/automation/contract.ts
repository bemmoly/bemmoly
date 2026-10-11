import type {
  ActorContextFactory,
  AuditRecorder,
  EventBus,
  JobRegistry,
  RequestContext,
  SqlClient,
} from '@bemmoly/core';
import type { z } from 'zod';
import type { Issue } from '../../../../shared/issues.ts';
import type { CommentsService } from '../comments/index.ts';
import type { IssueEventPayload } from '../issues/events.ts';
import type { IssuesService } from '../issues/index.ts';
import type { LabelsService } from '../labels/index.ts';
import type { Notice } from '../issues/notify.ts';
import type { LqlService } from '../lql/index.ts';
import type { WorkflowService } from '../workflow/index.ts';

/*
 * Automation is a pluggable capability: every trigger and every action is one file with
 * its arguments' schema, registered in its folder's index. The engine reads only these
 * shapes, so adding one is its file plus one registry line.
 */

/** What a trigger is asked about: one domain event, its payload as Work publishes it. */
export interface TriggerEvent {
  kind: string;
  payload: IssueEventPayload;
}

export interface TriggerDefinition<Args = unknown> {
  name: string;
  label: string;
  description: string;
  params: z.ZodType<Args>;
  /** The domain event kinds it listens to; a scheduled trigger listens to none. */
  events: readonly string[];
  matches(args: Args, event: TriggerEvent): boolean;
  /** A scheduled trigger's cron expression, read by the scheduler. */
  cron?(args: Args): string;
}

/** The services an action calls: the same ones a request goes through, nothing else. */
export interface AutomationServices {
  issues: IssuesService;
  comments: CommentsService;
  labels: Pick<LabelsService, 'list' | 'create'>;
  workflow: Pick<WorkflowService, 'issueTransitions'>;
  /** The issue's notification path: only people who may open it, named as Automation. */
  notify(ctx: RequestContext, issue: Issue, notice: Notice): Promise<void>;
  events: EventBus;
}

export interface ActionContext {
  /** The automation actor's context: authorize() checks what the rule's owner may do. */
  ctx: RequestContext;
  issue: Issue;
  services: AutomationServices;
  rule: { id: string; name: string };
  /** The person whose change triggered the run, when a person did. */
  triggeredBy: string | null;
}

export interface ActionDefinition<Args = unknown> {
  name: string;
  label: string;
  description: string;
  params: z.ZodType<Args>;
  /** One line for the run log: what it did. Throws a typed error when it cannot. */
  run(args: Args, action: ActionContext): Promise<string>;
}

export interface AutomationDeps {
  database?: SqlClient;
  audit?: AuditRecorder;
  events: EventBus;
  jobs?: Pick<JobRegistry, 'send'>;
  contextFor?: ActorContextFactory;
  lql: Pick<LqlService, 'matches' | 'query'>;
  services: AutomationServices;
  now?: () => Date;
  /** How many rules in a row may trigger each other before the chain stops; tests lower it. */
  maxDepth?: number;
}

/** Five rules in a row is a workflow; a sixth is almost always a loop. */
export const AUTOMATION_MAX_DEPTH = 5;
