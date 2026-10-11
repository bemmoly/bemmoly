import { z } from 'zod';

/** The code hosts Bemmoly links pull requests, branches and commits from; one file each. */
export const CODE_HOST_KINDS = ['github', 'gitlab'] as const;
export const codeHostKindSchema = z.enum(CODE_HOST_KINDS);
export type CodeHostKind = z.infer<typeof codeHostKindSchema>;

/** What a link points at on the host. */
export const CODE_LINK_KINDS = ['pull_request', 'branch', 'commit'] as const;
export const codeLinkKindSchema = z.enum(CODE_LINK_KINDS);
export type CodeLinkKind = z.infer<typeof codeLinkKindSchema>;

/** A pull or merge request's state, in the host-neutral words the issue page shows. */
export const CODE_LINK_STATES = ['open', 'draft', 'merged', 'closed'] as const;
export const codeLinkStateSchema = z.enum(CODE_LINK_STATES);
export type CodeLinkState = z.infer<typeof codeLinkStateSchema>;

export const CODE_CHECK_STATES = ['pending', 'passing', 'failing'] as const;
export const codeCheckStateSchema = z.enum(CODE_CHECK_STATES);
export type CodeCheckState = z.infer<typeof codeCheckStateSchema>;

export const CODE_REVIEW_STATES = ['review_required', 'approved', 'changes_requested'] as const;
export const codeReviewStateSchema = z.enum(CODE_REVIEW_STATES);
export type CodeReviewState = z.infer<typeof codeReviewStateSchema>;

/** How Bemmoly calls the host's API for backfill and the test: an app, or an access token. */
export const CODE_HOST_AUTH_MODES = ['app', 'token'] as const;
export const codeHostAuthModeSchema = z.enum(CODE_HOST_AUTH_MODES);

const numericId = z
  .string()
  .trim()
  .regex(/^\d{1,20}$/, 'A number, as the host shows it');
const pemPrivateKey = z
  .string()
  .trim()
  .min(64)
  .max(16_384)
  .refine(
    (value) =>
      /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]+-----END [A-Z ]*PRIVATE KEY-----/.test(value),
    'Paste the private key in PEM form, from BEGIN to END',
  );

/** Write-only secrets: omitted on an update keeps what is stored. */
export const codeHostCredentialsInputSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('token'),
    token: z.string().trim().min(8).max(4096).optional(),
  }),
  z.object({
    mode: z.literal('app'),
    appId: numericId,
    installationId: numericId,
    privateKey: pemPrivateKey.optional(),
  }),
]);
export type CodeHostCredentialsInput = z.infer<typeof codeHostCredentialsInputSchema>;

/** owner/repository on GitHub; group/subgroup/project on GitLab. */
export const codeRepositoryPathSchema = z
  .string()
  .trim()
  .max(255)
  .regex(/^[A-Za-z0-9_.-]+(\/[A-Za-z0-9_.-]+)+$/, 'A path such as acme/api');

const hostFields = {
  name: z.string().trim().min(1).max(80),
  /** The server's address for Enterprise Server and self-managed installs; null is the cloud. */
  baseUrl: z
    .url({ protocol: /^https?$/ })
    .max(2048)
    .nullable(),
  /** GitHub's webhook secret or GitLab's secret token. Write-only. */
  webhookSecret: z.string().min(16, 'Use at least 16 characters').max(256),
  credentials: codeHostCredentialsInputSchema,
  /** The repositories backfill reads recent pull requests from. */
  repositories: z.array(codeRepositoryPathSchema).max(100),
  enabled: z.boolean(),
};

const gitlabHasNoApp = (value: { kind?: CodeHostKind; credentials?: { mode: string } }) =>
  !(value.kind === 'gitlab' && value.credentials?.mode === 'app');
const NO_GITLAB_APP = {
  message: 'GitLab connects with a project or group access token',
  path: ['credentials'],
};

export const createCodeHostSchema = z
  .object({
    kind: codeHostKindSchema,
    ...hostFields,
    baseUrl: hostFields.baseUrl.default(null),
    repositories: hostFields.repositories.default([]),
    enabled: hostFields.enabled.default(true),
  })
  .refine(gitlabHasNoApp, NO_GITLAB_APP);
export type CreateCodeHostInput = z.input<typeof createCodeHostSchema>;
export type CreateCodeHost = z.infer<typeof createCodeHostSchema>;

export const updateCodeHostSchema = z.object({
  name: hostFields.name.optional(),
  baseUrl: hostFields.baseUrl.optional(),
  webhookSecret: hostFields.webhookSecret.optional(),
  credentials: hostFields.credentials.optional(),
  repositories: hostFields.repositories.optional(),
  enabled: hostFields.enabled.optional(),
});
export type UpdateCodeHostInput = z.input<typeof updateCodeHostSchema>;
export type UpdateCodeHost = z.infer<typeof updateCodeHostSchema>;

/** What happened to one inbound delivery. A refused signature is never stored. */
export const CODE_DELIVERY_OUTCOMES = ['processed', 'ignored', 'failed', 'test'] as const;
export const codeDeliveryOutcomeSchema = z.enum(CODE_DELIVERY_OUTCOMES);
export type CodeDeliveryOutcome = z.infer<typeof codeDeliveryOutcomeSchema>;

export const codeHostDeliverySchema = z.object({
  id: z.uuid(),
  event: z.string(),
  action: z.string().nullable(),
  outcome: codeDeliveryOutcomeSchema,
  /** "Pull request #42 opened in acme/api", in plain words. */
  summary: z.string(),
  error: z.string().nullable(),
  receivedAt: z.iso.datetime(),
});
export type CodeHostDelivery = z.infer<typeof codeHostDeliverySchema>;

export const codeHostSchema = z.object({
  id: z.uuid(),
  kind: codeHostKindSchema,
  name: z.string(),
  baseUrl: z.string().nullable(),
  /** Where the host sends deliveries; pasted into the host's webhook settings. */
  webhookUrl: z.string(),
  authMode: codeHostAuthModeSchema,
  appId: z.string().nullable(),
  installationId: z.string().nullable(),
  hasCredentials: z.boolean(),
  hasWebhookSecret: z.boolean(),
  repositories: z.array(z.string()),
  enabled: z.boolean(),
  lastDelivery: codeHostDeliverySchema.nullable(),
  /** The last refused or failed delivery, until a good one arrives. */
  lastError: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type CodeHost = z.infer<typeof codeHostSchema>;

export const codeHostsResponseSchema = z.object({ items: z.array(codeHostSchema) });
export type CodeHostsResponse = z.infer<typeof codeHostsResponseSchema>;

export const codeHostDeliveriesResponseSchema = z.object({
  items: z.array(codeHostDeliverySchema),
});
export type CodeHostDeliveriesResponse = z.infer<typeof codeHostDeliveriesResponseSchema>;

const checkResult = z.object({
  /** Null when there was nothing to check (no API credentials). */
  ok: z.boolean().nullable(),
  message: z.string(),
});

/** The test delivery: a signed ping through the webhook path, then one API call. */
export const codeHostTestResultSchema = z.object({
  webhook: checkResult,
  api: checkResult,
});
export type CodeHostTestResult = z.infer<typeof codeHostTestResultSchema>;

export const codeHostBackfillSchema = z.object({
  queued: z.boolean(),
  repositories: z.number().int().nonnegative(),
});
export type CodeHostBackfill = z.infer<typeof codeHostBackfillSchema>;

/** What the webhook answers the host; the host only reads the status. */
export const codeWebhookReceiptSchema = z.object({
  outcome: z.enum(['processed', 'ignored', 'duplicate', 'failed', 'test']),
});
export type CodeWebhookReceipt = z.infer<typeof codeWebhookReceiptSchema>;
