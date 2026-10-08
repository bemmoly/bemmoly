import { z } from 'zod';
import { fail, isSet, pass, type ValidatorRule } from './types.ts';

const params = z.object({
  minLength: z.number().int().min(1).max(2000).default(1),
});

/** The transition form must carry a comment, e.g. why QA failed; the issues service stores it. */
export const commentRequired: ValidatorRule<z.infer<typeof params>> = {
  name: 'comment_required',
  kind: 'validator',
  label: 'Comment required',
  description: 'The move must carry a comment of at least the given length',
  params,
  async validate(args, rule) {
    const comment = rule.submitted['comment'];
    if (!isSet(comment) || typeof comment !== 'string') return fail('Add a comment');
    return comment.trim().length >= args.minLength
      ? pass
      : fail(`The comment needs at least ${args.minLength} characters`);
  },
};
