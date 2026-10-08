import { z } from 'zod';
import { fail, fieldValue, pass, type ValidatorRule } from './types.ts';

const params = z.object({});

/** Work cannot start unestimated: a positive estimate from the form or already on the issue. */
export const estimateSet: ValidatorRule<z.infer<typeof params>> = {
  name: 'estimate_set',
  kind: 'validator',
  label: 'Estimate is set',
  description: 'The issue has a positive estimate',
  params,
  async validate(_args, rule) {
    const estimate = Number(fieldValue(rule, 'estimate') ?? Number.NaN);
    return Number.isFinite(estimate) && estimate > 0 ? pass : fail('Add an estimate');
  },
};
