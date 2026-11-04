import { z } from 'zod';

/*
 * Connecting a cloud, simply (product rule 9): the person chooses how Bemmoly signs in and what
 * it may reach (every project in a folder or organization, or only the projects they pick).
 * Bemmoly then shows the one command that grants exactly that, and "Check access" lists what it
 * can see. Checking creates nothing anywhere: POST /clouds/access-check stores nothing, and
 * connecting only records the projects it found.
 */

export const CLOUD_SETUP_PATHS = {
  accessCheck: '/api/v1/pipelines/clouds/access-check',
} as const;

/** A Google Cloud project id: 6 to 30 lowercase letters, digits and hyphens. */
export const projectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/, 'Use the project ID, such as acme-prod-421309');

/** "folders/417302018845", "organizations/1234567" or a folder's digits alone. */
export const reachParentSchema = z
  .string()
  .trim()
  .regex(
    /^((folders|organizations)\/)?[0-9]{6,20}$/,
    'Use a folder or organization ID, such as 417302018845',
  )
  .transform((value) => (value.includes('/') ? value : `folders/${value}`));

export const cloudReachSchema = z.discriminatedUnion('kind', [
  /** Every project under a folder or organization, including ones added later. */
  z.object({ kind: z.literal('folder'), parent: reachParentSchema }),
  /** Only these projects; Bemmoly sees nothing else. */
  z.object({ kind: z.literal('projects'), projects: z.array(projectIdSchema).min(1).max(100) }),
]);

export const accessCheckSignInSchema = z.enum([
  'vm',
  'application_default',
  'workload_identity_file',
]);

export const cloudAccessCheckBodySchema = z
  .object({
    provider: z.literal('gcp'),
    signIn: accessCheckSignInSchema,
    credentialFile: z.record(z.string(), z.unknown()).optional(),
    /** Left out: only check the sign-in and say who Bemmoly is. */
    reach: cloudReachSchema.optional(),
    /**
     * Creating projects: also check what bootstrap.sh granted on its folder and on the billing
     * account; the problems then name each grant still missing.
     */
    managed: z
      .object({
        folderId: z
          .string()
          .trim()
          .regex(/^(folders\/)?[0-9]{6,20}$/, 'Use the folder ID bootstrap.sh printed')
          .transform((value) => value.replace(/^folders\//, '')),
        billingAccountId: z
          .string()
          .trim()
          .regex(/^[0-9A-F]{6}-[0-9A-F]{6}-[0-9A-F]{6}$/, 'Use a billing account ID'),
      })
      .optional(),
  })
  .refine((body) => (body.signIn === 'workload_identity_file') === Boolean(body.credentialFile), {
    message: 'Choose the workload identity file only with that sign-in',
    path: ['credentialFile'],
  });

export const reachableProjectSchema = z.object({
  externalId: z.string(),
  name: z.string().nullable(),
  /** Bemmoly can deploy here: it sees the project and holds what a deploy needs. */
  ok: z.boolean(),
  services: z.object({ run: z.boolean(), build: z.boolean(), secrets: z.boolean() }),
  /** Each a sentence saying what to grant or turn on. */
  problems: z.array(z.string()),
});

export const cloudAccessCheckResponseSchema = z.object({
  signedIn: z.boolean(),
  /** "bemmoly@my-project.iam.gserviceaccount.com", or the person's own account. */
  principal: z.string().nullable(),
  /** Why signing in failed; once signed in, with `managed`, each folder or billing grant missing. */
  problems: z.array(z.string()),
  projects: z.array(reachableProjectSchema),
});

export type CloudReach = z.infer<typeof cloudReachSchema>;
export type CloudReachInput = z.input<typeof cloudReachSchema>;
export type CloudAccessCheckBody = z.input<typeof cloudAccessCheckBodySchema>;
export type ReachableProject = z.infer<typeof reachableProjectSchema>;
export type CloudAccessCheckResponse = z.infer<typeof cloudAccessCheckResponseSchema>;
