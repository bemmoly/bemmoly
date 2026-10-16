import { z } from 'zod';
import {
  environmentClassSchema,
  idSchema,
  isoDateTimeSchema,
  personRefSchema,
  scopeKindSchema,
  scopePathSchema,
  scopeRefSchema,
  slugSchema,
  teamRefSchema,
} from './common.ts';

/*
 * Access and policy (architecture §10): GET/POST/DELETE /api/v1/pipelines/bindings,
 * GET/POST/PATCH /policies, GET /policies/:id/versions, POST /access/checks (the checker and
 * "Why can't I?"). Roles are bound to teams at a scope; the owning team is implicitly
 * Maintainer. Every decision returns the trace that explains it.
 */

export const roleSchema = z.enum([
  'viewer',
  'developer',
  'maintainer',
  'release_manager',
  'platform_admin',
  'auditor',
]);

/** A scope as screens name it: "Commerce › Checkout". */
export const namedScopeSchema = scopeRefSchema.extend({
  name: z.string(),
  /** Names from the organisation down, e.g. ["Acme", "Commerce", "Checkout"]. */
  path: z.array(z.string()),
});

export const bindingSubjectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('team'), team: teamRefSchema }),
  z.object({ kind: z.literal('user'), user: personRefSchema }),
]);

export const roleBindingSchema = z.object({
  /** Null for the implicit owning-team Maintainer binding, which is never stored. */
  id: idSchema.nullable(),
  subject: bindingSubjectSchema,
  role: roleSchema,
  scope: namedScopeSchema,
  environmentClass: environmentClassSchema.nullable(),
  expiresAt: isoDateTimeSchema.nullable(),
  reason: z.string().nullable(),
  /** Bound higher up the tree and applying here; shown as "Acme (inherited)". */
  inherited: z.boolean(),
  inheritedFrom: namedScopeSchema.nullable(),
  /** The owning team's Maintainer role, from ownership rather than a binding. */
  implicit: z.boolean(),
  createdBy: personRefSchema.nullable(),
  createdAt: isoDateTimeSchema.nullable(),
});

export const listBindingsQuerySchema = z.object({
  scope: scopePathSchema.optional(),
  application: slugSchema.optional(),
  /** Include bindings inherited from wider scopes (the default on the Access screen). */
  inherited: z.stringbool().default(true),
});

export const bindingsResponseSchema = z.object({
  items: z.array(roleBindingSchema),
  /** "Owning teams are Maintainers of their own applications: 17 teams own applications here." */
  owningTeams: z.number().int(),
});

/** Bindings to people exist for break-glass only, and they expire. */
export const createBindingBodySchema = z
  .object({
    subject: z.object({ kind: z.enum(['team', 'user']), id: idSchema }),
    role: roleSchema,
    scope: scopeRefSchema,
    environmentClass: environmentClassSchema.optional(),
    expiresAt: isoDateTimeSchema.optional(),
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .refine((body) => body.subject.kind === 'team' || (body.expiresAt && body.reason), {
    message: 'A binding for one person needs an end time and a reason',
    path: ['expiresAt'],
  })
  .refine((body) => (body.scope.kind === 'organisation') === (body.scope.id === undefined), {
    message: 'Name the domain, group or application the binding is at',
    path: ['scope'],
  });

/** Who an approval must come from: the owning team, a team, an on-call schedule or a role. */
export const approverSourceSchema = z.union([
  z.literal('owning_team'),
  z.string().regex(/^team:[0-9a-f-]{36}$/),
  z.string().regex(/^oncall:[a-z0-9][a-z0-9-]{0,62}$/),
  z.string().regex(/^role:(viewer|developer|maintainer|release_manager|platform_admin|auditor)$/),
]);

export const policyRequirementsSchema = z.object({
  /** CEL, e.g. has_role("maintainer"). */
  requester: z.string().max(2000).optional(),
  approvals: z
    .array(
      z.object({
        from: approverSourceSchema,
        count: z.number().int().min(1).max(10),
        exclude: z.array(z.literal('authors')).default([]),
      }),
    )
    .default([]),
  /** Gate names with arguments as policies write them: "staging_healthy(\"30m\")". */
  gates: z.array(z.string().max(200)).default([]),
  /** "Mon-Thu 10:00-16:00 Asia/Kolkata". */
  window: z.string().max(120).optional(),
  /** CEL, e.g. freeze.active. */
  denyIf: z.string().max(2000).optional(),
});

export const policySchema = z.object({
  id: idSchema,
  key: slugSchema,
  name: z.string(),
  scope: namedScopeSchema,
  version: z.number().int().min(1),
  enabled: z.boolean(),
  /** Plain words: "Needs 2 approvals from the owning team, never the author, and 1 from SRE on call." */
  sentence: z.string(),
  /** CEL selector: service.tier == 0 && env.class == "prod". */
  applies: z.string(),
  requirements: policyRequirementsSchema,
  /** The policy as code (YAML), as "Code" shows it. */
  source: z.string(),
  sourceRepository: z.string().nullable(),
  updatedAt: isoDateTimeSchema,
  /**
   * A change waiting for a second Platform admin (Tier 0 policies), shown beside the
   * version in force until it is approved; null when nothing waits.
   */
  pending: z
    .object({
      version: z.number().int().min(1),
      sentence: z.string(),
      createdBy: personRefSchema.nullable(),
      createdAt: isoDateTimeSchema,
    })
    .nullable(),
});

export const policyVersionSchema = z.object({
  id: idSchema,
  version: z.number().int().min(1),
  applies: z.string(),
  requirements: policyRequirementsSchema,
  sentence: z.string(),
  source: z.string(),
  createdBy: personRefSchema.nullable(),
  /** A change to a policy that applies to Tier 0 needs a second Platform admin. */
  approvedBy: personRefSchema.nullable(),
  approvedAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
});

export const bindingParamsSchema = z.object({ id: idSchema });
export const policyParamsSchema = z.object({ id: idSchema });
export const policyVersionParamsSchema = z.object({
  id: idSchema,
  version: z.coerce.number().int().min(1),
});

export const listPoliciesQuerySchema = z.object({ scope: scopePathSchema.optional() });
export const policiesResponseSchema = z.object({ items: z.array(policySchema) });
export const policyVersionsResponseSchema = z.object({ items: z.array(policyVersionSchema) });

export const createPolicyBodySchema = z.object({
  key: slugSchema,
  name: z.string().trim().min(1).max(120),
  scope: scopeRefSchema,
  applies: z.string().min(1).max(2000),
  requirements: policyRequirementsSchema,
});

export const updatePolicyBodySchema = createPolicyBodySchema
  .omit({ key: true })
  .partial()
  .extend({ enabled: z.boolean().optional() });

export const accessActionSchema = z.enum([
  'view',
  'run',
  'deploy',
  'request_prod',
  'approve',
  'rollback',
  'change_variables',
  'manage',
  'platform',
]);

export const checkAccessBodySchema = z.object({
  /** Omitted means the person asking ("Why can't I?"). */
  user: idSchema.optional(),
  action: accessActionSchema,
  application: slugSchema.optional(),
  environment: slugSchema.optional(),
  scope: scopeRefSchema.optional(),
});

export const traceStepSchema = z.object({
  kind: z.enum(['binding', 'ownership', 'policy', 'freeze', 'window', 'fact']),
  /** "Checkout web: Developer at Checkout". */
  text: z.string(),
  effect: z.enum(['grant', 'deny', 'require', 'info']),
  ref: z.object({ kind: z.string(), id: idSchema.nullable() }).nullable(),
});

export const askWhoSchema = z.object({
  teams: z.array(teamRefSchema),
  /** "Ask Payments for access". */
  label: z.string(),
});

export const accessDecisionSchema = z.object({
  allowed: z.boolean(),
  /** "Tier 0 to Prod needs a Maintainer to request it." */
  sentence: z.string(),
  trace: z.array(traceStepSchema),
  askWho: askWhoSchema.nullable(),
  decisionId: idSchema.nullable(),
});

/** What a ForbiddenError carries in `details` from Pipelines, so any refusal can say why. */
export const forbiddenDetailsSchema = z.object({
  action: accessActionSchema,
  sentence: z.string(),
  trace: z.array(traceStepSchema),
  askWho: askWhoSchema.nullable(),
  scopeKind: scopeKindSchema.optional(),
});

export type Role = z.infer<typeof roleSchema>;
export type NamedScope = z.infer<typeof namedScopeSchema>;
export type BindingSubject = z.infer<typeof bindingSubjectSchema>;
export type RoleBinding = z.infer<typeof roleBindingSchema>;
export type ListBindingsQuery = z.input<typeof listBindingsQuerySchema>;
export type BindingsResponse = z.infer<typeof bindingsResponseSchema>;
export type CreateBindingBody = z.infer<typeof createBindingBodySchema>;
export type ApproverSource = z.infer<typeof approverSourceSchema>;
export type PolicyRequirements = z.infer<typeof policyRequirementsSchema>;
export type Policy = z.infer<typeof policySchema>;
export type PolicyVersion = z.infer<typeof policyVersionSchema>;
export type PoliciesResponse = z.infer<typeof policiesResponseSchema>;
export type PolicyVersionsResponse = z.infer<typeof policyVersionsResponseSchema>;
export type CreatePolicyBody = z.input<typeof createPolicyBodySchema>;
export type UpdatePolicyBody = z.input<typeof updatePolicyBodySchema>;
export type AccessAction = z.infer<typeof accessActionSchema>;
export type CheckAccessBody = z.infer<typeof checkAccessBodySchema>;
export type TraceStep = z.infer<typeof traceStepSchema>;
export type AskWho = z.infer<typeof askWhoSchema>;
export type AccessDecision = z.infer<typeof accessDecisionSchema>;
export type ForbiddenDetails = z.infer<typeof forbiddenDetailsSchema>;
