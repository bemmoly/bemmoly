import { z } from 'zod';
import { fail, fieldValue, isSet, pass, type ValidatorRule } from './types.ts';

const params = z.object({
  fields: z.array(z.string().trim().min(1).max(60)).min(1).max(20),
});

/** "Reviewer field is not empty" in the mock: the transition form must fill these before the move. */
export const requiredFields: ValidatorRule<z.infer<typeof params>> = {
  name: 'required_fields',
  kind: 'validator',
  label: 'Required fields',
  description: 'The named fields must have a value, from the form or already on the issue',
  params,
  async validate(args, rule) {
    const missing = args.fields.filter((field) => !isSet(fieldValue(rule, field)));
    return missing.length === 0 ? pass : fail(`Fill in ${missing.join(', ')}`);
  },
};
