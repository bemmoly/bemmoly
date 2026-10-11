import type { AutomationRule } from '@bemmoly/module-work/shared';
import { describe, expect, it } from 'vitest';
import { actionsSentence, outcomeLabel, runResult, triggerSentence } from './describe.ts';
import {
  draftOf,
  draftProblems,
  emptyDraft,
  move,
  newStep,
  toBody,
  type RuleDraft,
} from './model.ts';

const rule: AutomationRule = {
  id: '018f0000-0000-7000-8000-000000000d01',
  projectId: '018f0000-0000-7000-8000-000000000900',
  name: 'Tell the channel',
  enabled: true,
  isDraft: false,
  trigger: { name: 'issue_transitioned', args: { toStatus: 'Done' } },
  conditions: ['type = Bug'],
  actions: [
    { name: 'add_comment', args: { body: 'Shipped' } },
    { name: 'send_webhook', args: { webhookId: '018f0000-0000-7000-8000-000000000a00' } },
  ],
  createdBy: null,
  ownerId: null,
  ownerName: 'Rohan S.',
  aiRunId: null,
  lastRunAt: null,
  lastRunStatus: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

const withActions = (draft: RuleDraft, ...actions: RuleDraft['actions']) => ({
  ...draft,
  name: 'A rule',
  actions,
});

describe('the rule draft', () => {
  it('round-trips a saved rule into the same request', () => {
    const body = toBody(draftOf(rule), rule.projectId);
    expect(body).toMatchObject({
      name: rule.name,
      projectId: rule.projectId,
      trigger: rule.trigger,
      conditions: rule.conditions,
      actions: rule.actions,
    });
  });

  it('leaves out arguments left empty, so "Any status" matches any', () => {
    const draft = draftOf(rule);
    draft.trigger.args = { fromStatus: '', toStatus: ' Done ' };
    draft.conditions.push({ key: 'blank', query: '  ' });
    const body = toBody(draft, null);
    expect(body.trigger.args).toEqual({ toStatus: 'Done' });
    expect(body.conditions).toEqual(['type = Bug']);
  });

  it('names what is missing, by the path the server would', () => {
    expect(draftProblems(emptyDraft())).toMatchObject({
      name: 'Give the rule a name',
      actions: 'Add at least one action',
    });
    const transition = newStep('transition');
    const assign = { ...newStep('assign'), args: { to: 'user' } };
    const notify = { ...newStep('notify'), args: { recipients: [], userIds: [], message: 'Hi' } };
    const problems = draftProblems(withActions(emptyDraft(), transition, assign, notify));
    expect(problems['actions.0.args.status']).toBe('Pick a status');
    expect(problems['actions.1.args.userId']).toBe('Pick the person to assign');
    expect(problems['actions.2.args.recipients']).toBe('Pick who to notify');
  });

  it('asks a scheduled rule for a condition and a five-field schedule', () => {
    const draft = withActions(emptyDraft(), { ...newStep('add_label'), args: { label: 'infra' } });
    draft.trigger = { key: 't', name: 'scheduled', args: { cron: 'every day' } };
    const problems = draftProblems(draft);
    expect(problems['conditions']).toMatch(/needs a condition/);
    expect(problems['trigger.args.cron']).toMatch(/five-field cron/);
  });

  it('checks each condition with the query checker it is given', () => {
    const draft = withActions(emptyDraft(), { ...newStep('add_label'), args: { label: 'x' } });
    draft.conditions = [{ key: 'c', query: 'colour = red' }];
    expect(draftProblems(draft, () => 'Unknown field colour')).toEqual({
      'conditions.0': 'Unknown field colour',
    });
  });

  it('moves actions a step and keeps the ends put', () => {
    expect(move(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(move(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
  });
});

describe('rules and runs in words', () => {
  it('reads a rule as a sentence', () => {
    expect(triggerSentence(rule)).toBe('When an issue moves to “Done”');
    expect(actionsSentence(rule)).toBe('then comment, send a webhook');
    expect(
      triggerSentence({
        ...rule,
        trigger: { name: 'field_changed', args: { fields: ['priority', 'assigneeId'] } },
      }),
    ).toBe('When Priority or Assignee changes');
  });

  it('reads a run result, and nothing from a run without one', () => {
    const result = {
      conditionsMet: true,
      actions: [
        { name: 'add_comment', ok: true, message: 'Commented' },
        { name: 'send_webhook', ok: false, message: 'Paused' },
      ],
    };
    expect(outcomeLabel({ result })).toBe('1 of 2 done');
    expect(outcomeLabel({ result: { conditionsMet: false, actions: [] } })).toBe(
      'Conditions not met',
    );
    expect(runResult({ result: null })).toBeNull();
    expect(outcomeLabel({ result: 'garbage' })).toBeNull();
  });
});
