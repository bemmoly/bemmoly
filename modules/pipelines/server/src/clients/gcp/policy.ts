import { z } from 'zod';

/*
 * IAM policies have the same shape on projects, service accounts, repositories and secrets.
 * Grants are read-modify-write with the etag, so a concurrent change fails instead of being
 * overwritten; adding a binding that is already there changes nothing and writes nothing.
 */

export const policySchema = z.object({
  version: z.number().optional(),
  etag: z.string().optional(),
  bindings: z
    .array(
      z.object({
        role: z.string(),
        members: z.array(z.string()).default([]),
        condition: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .default([]),
});

export type IamPolicy = z.infer<typeof policySchema>;

/** The policy with `member` in `role`, or null when it is there already. */
export function withBinding(policy: IamPolicy, role: string, member: string): IamPolicy | null {
  const binding = policy.bindings.find((entry) => entry.role === role && !entry.condition);
  if (binding?.members.includes(member)) return null;
  const bindings = binding
    ? policy.bindings.map((entry) =>
        entry === binding ? { ...entry, members: [...entry.members, member] } : entry,
      )
    : [...policy.bindings, { role, members: [member] }];
  return { ...policy, bindings };
}

export function hasBinding(policy: IamPolicy, role: string, member: string): boolean {
  return policy.bindings.some((entry) => entry.role === role && entry.members.includes(member));
}

/** "serviceAccount:deployer@acme-commerce-prod.iam.gserviceaccount.com". */
export const serviceAccountMember = (email: string) => `serviceAccount:${email}`;

/**
 * The policy member for whoever Bemmoly signs in as: a service account on a VM or through
 * federation, or a person's own account on a laptop install.
 */
export const principalMember = (email: string) =>
  email.endsWith('.gserviceaccount.com') ? `serviceAccount:${email}` : `user:${email}`;
