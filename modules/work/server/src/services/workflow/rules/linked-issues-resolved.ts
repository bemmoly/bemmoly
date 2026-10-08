import { z } from 'zod';
import { fail, pass, type ConditionRule } from './types.ts';

const params = z.object({});

/** Blockers must be resolved before the blocked issue moves; "relates" and "duplicates" do not hold it. */
export const linkedIssuesResolved: ConditionRule<z.infer<typeof params>> = {
  name: 'linked_issues_resolved',
  kind: 'condition',
  label: 'Linked issues are resolved',
  description: 'Every issue that blocks this one is in a done status',
  params,
  async check(_args, rule) {
    const open = await rule.reads.unresolvedLinkedIssues(rule.sql, rule.issue.id);
    return open === 0
      ? pass
      : fail(`${open} blocking issue${open === 1 ? ' is' : 's are'} not resolved`);
  },
};
