import { z } from 'zod';
import { idSchema, isoDateTimeSchema, personRefSchema, slugSchema } from './common.ts';
import { changeRiskSchema } from './change-requests.ts';
import {
  approvalConditionSchema,
  deployWindowSchema,
  versionsAllowedSchema,
} from './environments-v2.ts';
import { approvalGroupRefSchema } from './roles.ts';

/*
 * What the New change request form and the Deploy or promote dialog offer for one target
 * environment: whether it needs a change request at all, the steps its rule asks for at the
 * chosen risk with the people the requester may pick (the group's members, never the
 * requester), and the versions each service may move to.
 */

export const changeRequestOptionsQuerySchema = z.object({
  /** Absent: the first environment on the path that has an approval rule, else the first. */
  environment: slugSchema.optional(),
  risk: changeRiskSchema.default('low'),
  /** Only this service's versions; absent, every service with a version that may go. */
  application: slugSchema.optional(),
});

export const changeRequestOptionStepSchema = z.object({
  /** The step's place in the environment's rule; picks name it. */
  position: z.number().int().min(0),
  group: approvalGroupRefSchema,
  count: z.number().int().min(1),
  when: approvalConditionSchema,
  /** False when the step's condition does not hold at this risk: it is skipped. */
  applies: z.boolean(),
  /** The group's members the requester may pick. */
  candidates: z.array(personRefSchema),
});

export const changeRequestOptionVersionSchema = z.object({
  releaseId: idSchema,
  version: z.string(),
  commitSha: z.string(),
  /** The release's run's title or the release notes: what changed. */
  summary: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  /** Environment keys this version runs in now. */
  runningIn: z.array(slugSchema),
  /** May go here: always when any version may, else only once it passed the previous one. */
  allowed: z.boolean(),
});

export const changeRequestOptionServiceSchema = z.object({
  key: slugSchema,
  name: z.string(),
  /** What runs in the target environment now, or null. */
  current: z.object({ releaseId: idSchema, version: z.string() }).nullable(),
  versions: z.array(changeRequestOptionVersionSchema),
});

export const changeRequestOptionsSchema = z.object({
  environment: z.object({ key: slugSchema, name: z.string() }),
  /** Every environment on the path, in order, for the target picker. */
  environments: z.array(
    z.object({ key: slugSchema, name: z.string(), needsChangeRequest: z.boolean() }),
  ),
  /** False: no approval rule, so versions deploy here directly. */
  needsChangeRequest: z.boolean(),
  previousEnvironment: z.object({ key: slugSchema, name: z.string() }).nullable(),
  versionsAllowed: versionsAllowedSchema,
  window: deployWindowSchema,
  steps: z.array(changeRequestOptionStepSchema),
  services: z.array(changeRequestOptionServiceSchema),
  /** Whether the person asking may deploy without approval (Platform admins). */
  canEmergencyDeploy: z.boolean(),
});

export type ChangeRequestOptionsQuery = z.infer<typeof changeRequestOptionsQuerySchema>;
export type ChangeRequestOptionStep = z.infer<typeof changeRequestOptionStepSchema>;
export type ChangeRequestOptionVersion = z.infer<typeof changeRequestOptionVersionSchema>;
export type ChangeRequestOptionService = z.infer<typeof changeRequestOptionServiceSchema>;
export type ChangeRequestOptions = z.infer<typeof changeRequestOptionsSchema>;
