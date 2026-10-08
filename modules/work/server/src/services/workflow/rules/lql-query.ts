import { parseLql } from '@bemmoly/shared';
import { z } from 'zod';
import { fail, pass, type ConditionRule } from './types.ts';

const params = z
  .object({ query: z.string().trim().min(1).max(4000) })
  .refine((args) => parseLql(args.query).ok, { message: 'The query does not parse' });

/**
 * The "custom query" condition of the tech design. The evaluator is the LQL
 * compiler of the boards stream; without one the condition says so rather
 * than passing, because a missing guard is worse than a blocked move.
 */
export const lqlQuery: ConditionRule<z.infer<typeof params>> = {
  name: 'lql_query',
  kind: 'condition',
  label: 'Issue matches a query',
  description: 'The issue matches the given LQL query',
  params,
  available: (deps) => deps.lql !== undefined,
  async check(args, rule) {
    if (!rule.lql) return fail('Query conditions are not available on this install');
    return (await rule.lql.matches(rule.ctx, rule.issue.id, args.query))
      ? pass
      : fail(`The issue does not match "${args.query}"`);
  },
};
