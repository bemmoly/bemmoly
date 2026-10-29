import { z } from 'zod';
import { customFieldKeySchema, type CustomFieldKind } from './definitions.ts';

/*
 * Filters and sorts over custom fields, compiled by the kernel to SQL a module embeds in its
 * own list query (ADR 0052).
 */

export const FIELD_FILTER_OPERATORS = [
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'contains',
  'in',
  'is_empty',
  'is_not_empty',
] as const;
export type FieldFilterOperator = (typeof FIELD_FILTER_OPERATORS)[number];

export const fieldFilterSchema = z.object({
  field: customFieldKeySchema,
  operator: z.enum(FIELD_FILTER_OPERATORS),
  value: z
    .union([z.string().max(500), z.number().finite(), z.boolean(), z.array(z.string()).max(100)])
    .optional(),
});
export type FieldFilter = z.infer<typeof fieldFilterSchema>;

export const fieldSortSchema = z.object({
  field: customFieldKeySchema,
  direction: z.enum(['asc', 'desc']).default('asc'),
});
export type FieldSort = z.infer<typeof fieldSortSchema>;

const ORDERED: readonly FieldFilterOperator[] = ['gt', 'gte', 'lt', 'lte'];
const ALWAYS: readonly FieldFilterOperator[] = ['eq', 'neq', 'in', 'is_empty', 'is_not_empty'];

/** Which operators make sense for a kind; the compiler refuses the rest. */
export function operatorsFor(kind: CustomFieldKind): readonly FieldFilterOperator[] {
  switch (kind) {
    case 'text':
    case 'long_text':
      return [...ALWAYS, 'contains'];
    case 'number':
    case 'money':
    case 'date':
      return [...ALWAYS, ...ORDERED];
    case 'multi_select':
      return ['in', 'is_empty', 'is_not_empty'];
    case 'boolean':
      return ['eq', 'neq'];
    case 'select':
    case 'person':
    case 'file':
      return ALWAYS;
  }
}
