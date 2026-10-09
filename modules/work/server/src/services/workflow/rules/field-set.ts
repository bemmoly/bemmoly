import { z } from 'zod';
import { fail, fieldValue, isSet, pass, type ConditionRule } from './types.ts';

const params = z.object({
  /** An issue column in camelCase or snake_case, or a custom field key. */
  field: z.string().trim().min(1).max(60),
});

/** "A pull request must be linked" in the mock is this rule over a custom field. */
export const fieldSet: ConditionRule<z.infer<typeof params>> = {
  name: 'field_set',
  kind: 'condition',
  label: 'Field is set',
  description: 'The issue has a value in the named field',
  params,
  async check(args, rule) {
    return isSet(fieldValue(rule, args.field)) ? pass : fail(`${args.field} must be set`);
  },
};
