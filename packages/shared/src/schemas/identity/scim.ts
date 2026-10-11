import { z } from 'zod';

/** SCIM 2.0 (RFC 7643, RFC 7644) as identity providers send it: Users, Groups and PATCH. */
export const SCIM_SCHEMAS = {
  user: 'urn:ietf:params:scim:schemas:core:2.0:User',
  group: 'urn:ietf:params:scim:schemas:core:2.0:Group',
  list: 'urn:ietf:params:scim:api:messages:2.0:ListResponse',
  patch: 'urn:ietf:params:scim:api:messages:2.0:PatchOp',
  error: 'urn:ietf:params:scim:api:messages:2.0:Error',
} as const;

const text = (max: number) => z.string().trim().max(max);

/** Some providers send booleans as strings ("True"); RFC 7643 says boolean, so both are read. */
const scimBoolean = z.union([
  z.boolean(),
  z
    .string()
    .regex(/^(true|false)$/i)
    .transform((value) => value.toLowerCase() === 'true'),
]);

const scimEmail = z
  .object({
    value: text(320),
    primary: scimBoolean.optional(),
    type: text(64).optional(),
  })
  .loose();

const scimName = z
  .object({
    formatted: text(200).optional(),
    givenName: text(100).optional(),
    familyName: text(100).optional(),
  })
  .loose();

export const scimUserInputSchema = z
  .object({
    schemas: z.array(z.string()).optional(),
    externalId: text(512).optional(),
    userName: text(320).min(1),
    name: scimName.optional(),
    displayName: text(200).optional(),
    emails: z.array(scimEmail).max(20).optional(),
    active: scimBoolean.optional(),
  })
  .loose();

const scimMember = z.object({ value: z.string().min(1).max(64), display: z.string().optional() });

export const scimGroupInputSchema = z
  .object({
    schemas: z.array(z.string()).optional(),
    externalId: text(512).optional(),
    displayName: text(80).min(1),
    members: z.array(scimMember).max(10_000).optional(),
  })
  .loose();

export const scimPatchOperationSchema = z.object({
  op: z
    .string()
    .transform((value) => value.toLowerCase())
    .pipe(z.enum(['add', 'replace', 'remove'])),
  path: z.string().max(512).optional(),
  value: z.unknown().optional(),
});

export const scimPatchSchema = z.object({
  schemas: z.array(z.string()).optional(),
  Operations: z.array(scimPatchOperationSchema).min(1).max(1000),
});

export const scimListQuerySchema = z.object({
  filter: z.string().max(1024).optional(),
  startIndex: z.coerce.number().int().min(1).default(1),
  count: z.coerce.number().int().min(0).max(200).default(100),
});

export const scimIdParamsSchema = z.object({ id: z.string().min(1).max(64) });

export type ScimUserInput = z.infer<typeof scimUserInputSchema>;
export type ScimGroupInput = z.infer<typeof scimGroupInputSchema>;
export type ScimPatchOperation = z.infer<typeof scimPatchOperationSchema>;
export type ScimPatch = z.infer<typeof scimPatchSchema>;
export type ScimListQuery = z.infer<typeof scimListQuerySchema>;
