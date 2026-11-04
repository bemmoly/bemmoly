import { z } from 'zod';
import { slugSchema } from './common.ts';
import { pipelineSpecSchema } from './pipeline-spec.ts';

/*
 * Setting up a service's pipeline (product rules 1, 6 and 8), the built-in templates, and the
 * fresh-install setup checklist on For you. Nothing here has a default the server applies on
 * its own: a service starts with no choices made and no triggers; "Use suggested" only fills
 * the form a person then confirms.
 */

export const PIPELINE_SETUP_PATHS = {
  /** GET and PUT a service's choices. */
  setup: (application: string) =>
    `/api/v1/pipelines/applications/${encodeURIComponent(application)}/pipeline-setup`,
  /** The pipeline files Bemmoly can read in the service's repository. */
  repositoryFiles: (application: string) =>
    `/api/v1/pipelines/applications/${encodeURIComponent(application)}/pipeline-setup/repository-files`,
  /** PUT the pipeline the editor saved, with its triggers. */
  definition: (application: string) =>
    `/api/v1/pipelines/applications/${encodeURIComponent(application)}/pipeline-definition`,
  /** Built-in templates, with steps for the environments that exist. */
  builtInTemplates: '/api/v1/pipelines/templates/built-in',
  checklist: '/api/v1/pipelines/setup/checklist',
  /** POST: Start over. Removes every Pipelines record on the install; admins only. */
  reset: '/api/v1/pipelines/setup/reset',
} as const;

/** The words the person types to confirm Start over. */
export const START_OVER_PHRASE = 'start over';

export const startOverBodySchema = z.object({
  confirm: z.literal(START_OVER_PHRASE, { error: `Type "${START_OVER_PHRASE}" to confirm` }),
});

export const startOverResponseSchema = z.object({
  /** How many records went, for the toast; tables with nothing in them are left out. */
  removed: z.number().int().min(0),
});

export type StartOverBody = z.infer<typeof startOverBodySchema>;
export type StartOverResponse = z.infer<typeof startOverResponseSchema>;

/** Start from nothing, from a built-in template, or from a file already in the repository. */
export const pipelineStartSchema = z.enum(['empty', 'template', 'repository']);

/** Keep the pipeline in Bemmoly, or as `.bemmoly/*.yml` in the repository (via a pull request). */
export const pipelineStoreSchema = z.enum(['bemmoly', 'repository']);

/** How a passing build is numbered as a version. */
export const versionSchemeSchema = z.enum(['semver_commits', 'build_number', 'git_tag', 'commit']);

export const builtInTemplateKeySchema = z.enum([
  'dev-stage-production',
  'one-environment',
  'cloud-run-job',
  'pull-request-checks',
]);

export const pipelineTriggerSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('push'), branch: z.string().min(1).max(200) }),
  z.object({ kind: z.literal('pull_request') }),
  /** Five-field cron and an IANA time zone. */
  z.object({ kind: z.literal('schedule'), cron: z.string().min(1).max(120), timeZone: z.string() }),
]);

export const pipelineSetupSchema = z.object({
  application: slugSchema,
  /** Null until someone chooses. */
  start: pipelineStartSchema.nullable(),
  template: builtInTemplateKeySchema.nullable(),
  /** The repository file read when start is "repository". */
  repositoryFile: z.string().nullable(),
  store: pipelineStoreSchema.nullable(),
  versionScheme: versionSchemeSchema.nullable(),
  /** Empty until a trigger is added: the pipeline runs when someone presses Run. */
  triggers: z.array(pipelineTriggerSchema),
});

export const savePipelineSetupBodySchema = z
  .object({
    start: pipelineStartSchema,
    template: builtInTemplateKeySchema.optional(),
    repositoryFile: z.string().min(1).max(500).optional(),
    store: pipelineStoreSchema,
    versionScheme: versionSchemeSchema,
    triggers: z.array(pipelineTriggerSchema).max(20).default([]),
  })
  .refine((body) => body.start !== 'template' || body.template, {
    message: 'Pick a template',
    path: ['template'],
  })
  .refine((body) => body.start !== 'repository' || body.repositoryFile, {
    message: 'Pick the file in the repository',
    path: ['repositoryFile'],
  });

/**
 * What a save answers: the setup as stored, and when the pipeline lives in the repository the
 * pull request that writes it there (or why none could be opened yet).
 */
export const savedPipelineSetupSchema = pipelineSetupSchema.extend({
  pullRequestUrl: z.string().nullable(),
  /** Set when the change waits: the code host is not connected, the file could not be read. */
  pendingReason: z.string().nullable(),
  /** Steps of a repository file Bemmoly cannot run as they are, named so nothing is lost. */
  skipped: z.array(z.string()),
});

/** The editor's save: the whole pipeline as drawn, and the triggers that start it. */
export const savePipelineDefinitionBodySchema = z.object({
  definition: pipelineSpecSchema,
  triggers: z.array(pipelineTriggerSchema).max(20),
});

export const repositoryFileCandidateSchema = z.object({
  path: z.string(),
  kind: z.enum(['bemmoly', 'github_actions']),
});

export const repositoryFilesResponseSchema = z.object({
  /** False when no code host can read the service's repository. */
  readable: z.boolean(),
  items: z.array(repositoryFileCandidateSchema),
});

/** A template's preview: its groups of steps, as the setup screen and Platform › Templates draw. */
export const builtInTemplateSummarySchema = z.object({
  key: builtInTemplateKeySchema,
  name: z.string(),
  description: z.string(),
  suggested: z.boolean(),
  groups: z.array(
    z.object({
      name: z.string(),
      /** Set when the group deploys to or runs in an environment that exists. */
      environment: slugSchema.nullable(),
      steps: z.array(z.string()),
    }),
  ),
  /** The trigger it would suggest, in words; never added on its own. */
  suggestedTrigger: z.string(),
  /** Environments the template names that do not exist, whose steps were left out. */
  leftOut: z.array(z.string()),
  /** The pipeline it makes here, for "Copy and edit" into a repository file. */
  definition: pipelineSpecSchema.optional(),
});

export const builtInTemplatesResponseSchema = z.object({
  items: z.array(builtInTemplateSummarySchema),
});

export const setupStepKeySchema = z.enum([
  'cloud',
  'environments',
  'people',
  'services',
  'pipelines',
  'templates',
]);

export const setupStepSchema = z.object({
  key: setupStepKeySchema,
  done: z.boolean(),
  optional: z.boolean(),
  /** The step that must be done first, or null when this one can start now. */
  blockedBy: setupStepKeySchema.nullable(),
});

/** In checklist order: cloud, environments, people, services, pipelines, templates. */
export const setupChecklistResponseSchema = z.object({
  steps: z.array(setupStepSchema).length(6),
  /** Every required step is done: For you stops showing the checklist. */
  complete: z.boolean(),
  /** "What's switched on": everything starts off, so a fresh install says None and Off. */
  switchedOn: z.object({
    /** Connected clouds by name, "Google Cloud". */
    clouds: z.array(z.string()),
    /** Some service's pipeline runs on push. */
    deployOnPush: z.boolean(),
    /** The version schemes services chose, each once. */
    versionSchemes: z.array(versionSchemeSchema),
  }),
});

export type PipelineStart = z.infer<typeof pipelineStartSchema>;
export type PipelineStore = z.infer<typeof pipelineStoreSchema>;
export type VersionScheme = z.infer<typeof versionSchemeSchema>;
export type BuiltInTemplateKey = z.infer<typeof builtInTemplateKeySchema>;
export type PipelineTrigger = z.infer<typeof pipelineTriggerSchema>;
export type PipelineSetup = z.infer<typeof pipelineSetupSchema>;
export type SavePipelineSetupBody = z.infer<typeof savePipelineSetupBodySchema>;
export type SavedPipelineSetup = z.infer<typeof savedPipelineSetupSchema>;
export type SavePipelineDefinitionBody = z.input<typeof savePipelineDefinitionBodySchema>;
export type RepositoryFileCandidate = z.infer<typeof repositoryFileCandidateSchema>;
export type RepositoryFilesResponse = z.infer<typeof repositoryFilesResponseSchema>;
export type BuiltInTemplateSummary = z.infer<typeof builtInTemplateSummarySchema>;
export type BuiltInTemplatesResponse = z.infer<typeof builtInTemplatesResponseSchema>;
export type SetupStepKey = z.infer<typeof setupStepKeySchema>;
export type SetupStep = z.infer<typeof setupStepSchema>;
export type SetupChecklistResponse = z.infer<typeof setupChecklistResponseSchema>;
