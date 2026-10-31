import { z } from 'zod';
import { slugSchema } from './common.ts';

/*
 * A plain variable may name another application's address: `${{ apps.cart-api.url }}` is the
 * address services in the same environment reach it on, and `${{ apps.cart-api.publicUrl }}`
 * the one the internet reaches. Each is filled in at deploy time from where that application
 * runs in that environment, so the same value works on Cloud Run in Stage and on GKE in Prod.
 * Addresses are not secrets, so the filled-in value is shown.
 */

export const APP_REFERENCE_FIELDS = ['url', 'publicUrl'] as const;

export const appReferenceFieldSchema = z.enum(APP_REFERENCE_FIELDS);

/** Matches one reference; group 1 is the application's key, group 2 the field. */
export const APP_REFERENCE_PATTERN =
  /\$\{\{\s*apps\.([a-z0-9][a-z0-9-]{0,62})\.(url|publicUrl)\s*\}\}/g;

export interface AppReference {
  application: string;
  field: z.infer<typeof appReferenceFieldSchema>;
  /** The reference as written, to replace. */
  text: string;
}

/** Every reference in a value, in order. */
export function appReferencesOf(value: string): AppReference[] {
  return [...value.matchAll(APP_REFERENCE_PATTERN)].map((match) => ({
    application: match[1] ?? '',
    field: match[2] === 'publicUrl' ? 'publicUrl' : 'url',
    text: match[0],
  }));
}

/** `${{ apps.cart-api.url }}`, as the variable dialog inserts it. */
export const appReferenceText = (application: string, field: AppReference['field']) =>
  `\${{ apps.${application}.${field} }}`;

/** One environment's filled-in value, or why it cannot be filled in yet. */
export const resolvedValueSchema = z.object({
  environment: slugSchema,
  value: z.string().nullable(),
  problem: z.string().nullable(),
});

export type ResolvedValue = z.infer<typeof resolvedValueSchema>;
