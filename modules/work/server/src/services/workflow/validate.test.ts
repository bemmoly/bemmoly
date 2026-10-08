import { describe, expect, it } from 'vitest';
import type { WorkflowDraft } from '../../../../shared/index.ts';
import { validateDraft } from './validate.ts';

const status = (id: string, category: 'todo' | 'in_progress' | 'done', position: number) => ({
  id,
  name: id,
  category,
  position,
});

const edge = (
  id: string,
  from: string | null,
  to: string,
  rules?: WorkflowDraft['transitions'][number]['rules'],
) => ({
  id,
  fromStatusId: from,
  toStatusId: to,
  name: id,
  position: 0,
  ...(rules ? { rules } : {}),
});

const sound: WorkflowDraft = {
  statuses: [
    status('Backlog', 'todo', 0),
    status('Doing', 'in_progress', 1),
    status('Done', 'done', 2),
  ],
  transitions: [edge('start', 'Backlog', 'Doing'), edge('finish', 'Doing', 'Done')],
};

describe('validateDraft', () => {
  it('accepts the shape the mock draws', () => {
    expect(validateDraft(sound)).toEqual({ valid: true, problems: [] });
  });

  it('needs a done status and unique names', () => {
    const draft: WorkflowDraft = {
      statuses: [status('Backlog', 'todo', 0), { ...status('x', 'todo', 1), name: 'backlog ' }],
      transitions: [edge('t', 'Backlog', 'x')],
    };
    expect(validateDraft(draft).problems).toEqual([
      { code: 'no_done_status', message: 'Add a status in the Done category' },
      {
        code: 'duplicate_status_name',
        message: 'Two statuses are named "backlog "',
        statusId: 'x',
      },
    ]);
  });

  it('flags a status nothing leads to, unless an Any transition reaches it', () => {
    const island = { ...sound, statuses: [...sound.statuses, status('Lost', 'done', 3)] };
    expect(validateDraft(island).problems).toEqual([
      { code: 'unreachable_status', message: 'No transition leads to "Lost"', statusId: 'Lost' },
    ]);
    const closed = { ...island, transitions: [...sound.transitions, edge('close', null, 'Lost')] };
    expect(validateDraft(closed).valid).toBe(true);
  });

  it('flags a transition to or from a missing status', () => {
    const draft = {
      ...sound,
      transitions: [...sound.transitions, edge('gone', 'Doing', 'Nowhere')],
    };
    expect(validateDraft(draft).problems).toEqual([
      {
        code: 'transition_missing_status',
        message: '"gone" points at a status that no longer exists',
        transitionId: 'gone',
      },
    ]);
  });

  it('flags rules the registry does not know, in the wrong slot, or with bad params', () => {
    const draft = {
      ...sound,
      transitions: [
        edge('start', 'Backlog', 'Doing', {
          conditions: [
            { name: 'required_fields', args: {} },
            { name: 'nope', args: {} },
          ],
          validators: [{ name: 'required_fields', args: { fields: [] } }],
          postActions: [{ name: 'set_resolution', args: { resolved: 'yes' } }],
        }),
        edge('finish', 'Doing', 'Done', {
          conditions: [{ name: 'field_set', args: { field: 'reviewer' } }],
          validators: [],
          postActions: [{ name: 'clear_sprint', args: {} }],
        }),
      ],
    };
    const { problems } = validateDraft(draft);
    expect(problems.map((problem) => [problem.code, problem.transitionId])).toEqual([
      ['unknown_rule', 'start'],
      ['unknown_rule', 'start'],
      ['invalid_rule_params', 'start'],
      ['invalid_rule_params', 'start'],
    ]);
    expect(problems[0]?.message).toBe('"start" uses an unknown condition "required_fields"');
    expect(problems[2]?.message).toContain('Required fields fields:');
  });
});
