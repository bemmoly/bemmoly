import { z } from 'zod';
import { applicationRefSchema } from './catalog.ts';
import {
  glyphStateSchema,
  idSchema,
  isoDateTimeSchema,
  personRefSchema,
  teamRefSchema,
} from './common.ts';
import { environmentRefSchema } from './environments.ts';

/*
 * For you: GET /api/v1/pipelines/for-you?tab=in-flight|shipped. Where an engineer lands:
 * their changes as journeys across every environment, the approvals waiting on them, their
 * teams' broken main and their on-call. Nothing here belongs to anyone else. One request.
 */

export const forYouQuerySchema = z.object({
  tab: z.enum(['in-flight', 'shipped']).default('in-flight'),
});

/** One station of a journey: Build, Test, Dev, Staging, Prod asia… */
export const journeyStationSchema = z.object({
  key: z.string(),
  label: z.string(),
  state: glyphStateSchema,
  /** "2m", "25% canary", "approval", "unit 2 of 3". */
  detail: z.string().nullable(),
  /** The station the change is at now. */
  live: z.boolean(),
  environment: environmentRefSchema.nullable(),
});

export const journeyNoteSchema = z.object({
  glyph: glyphStateSchema,
  text: z.string(),
  action: z.enum(['open', 'remind', 'rerun_failed']).nullable(),
  /** "Failed 3 of last 50 on main". */
  flag: z.string().nullable(),
});

export const journeySchema = z.object({
  id: z.string(),
  title: z.string(),
  repository: z.string().nullable(),
  commitSha: z.string(),
  issueKey: z.string().nullable(),
  application: applicationRefSchema.nullable(),
  stations: z.array(journeyStationSchema),
  /** How far along the line, 0 to 1. */
  progress: z.number().min(0).max(1),
  note: journeyNoteSchema,
  runId: idSchema.nullable(),
  releaseId: idSchema.nullable(),
  promotionId: idSchema.nullable(),
  updatedAt: isoDateTimeSchema,
});

export const waitingApprovalSchema = z.object({
  kind: z.enum(['promotion', 'train']),
  promotionId: idSchema.nullable(),
  departureId: idSchema.nullable(),
  /** The application, or the train's name ("11:00 Commerce train"). */
  title: z.string(),
  application: applicationRefSchema.nullable(),
  /** "v5.2.0", or "14 services" for a train. */
  version: z.string(),
  environment: environmentRefSchema,
  requester: personRefSchema.nullable(),
  /** "all gates passed", "window opens 10:00", "2 gates waiting". */
  gatesSummary: z.string(),
  allGatesPassed: z.boolean(),
  requestedAt: isoDateTimeSchema,
});

export const teamMainSchema = z.object({
  team: teamRefSchema,
  mainState: z.enum(['healthy', 'broken']),
  since: isoDateTimeSchema.nullable(),
  culprit: z
    .object({
      commitSha: z.string(),
      author: personRefSchema.nullable(),
      authorLogin: z.string().nullable(),
      application: applicationRefSchema.nullable(),
      failingJob: z.string(),
      runId: idSchema,
    })
    .nullable(),
});

export const onCallSchema = z.object({
  scheduleKey: z.string(),
  /** "Payments primary". */
  label: z.string(),
  until: isoDateTimeSchema,
  /** "6 deploys to Payments services in the last hour, none failing." */
  summary: z.string(),
});

export const forYouSchema = z.object({
  journeys: z.array(journeySchema),
  counts: z.object({ inFlight: z.number().int(), shippedThisWeek: z.number().int() }),
  waitingForMe: z.array(waitingApprovalSchema),
  myTeams: z.array(teamMainSchema),
  onCall: onCallSchema.nullable(),
});

export type ForYouQuery = z.input<typeof forYouQuerySchema>;
export type JourneyStation = z.infer<typeof journeyStationSchema>;
export type JourneyNote = z.infer<typeof journeyNoteSchema>;
export type Journey = z.infer<typeof journeySchema>;
export type WaitingApproval = z.infer<typeof waitingApprovalSchema>;
export type TeamMain = z.infer<typeof teamMainSchema>;
export type OnCall = z.infer<typeof onCallSchema>;
export type ForYou = z.infer<typeof forYouSchema>;
