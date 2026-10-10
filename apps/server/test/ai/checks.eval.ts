import { describe, expect, it } from 'vitest';
import {
  answerCites,
  attributedBullets,
  changedWords,
  everyPointCites,
  findsRollbackConflict,
  markdownTable,
  minimalDiff,
  noOtherFindings,
  noPreamble,
  planTouchesOnly,
  shortCompletion,
  taskList,
  type Finding,
} from './checks.ts';

/* The golden checks catch what they promise to: each one fails a bad output. */

const offered = new Set(['c1', 'c2']);

const conflict: Finding = {
  claim: 'Sessions stay valid for 15 minutes.',
  location: { heading: 'Rollback', paragraph: 6 },
  issueKey: 'PLT-204',
  issueValue: 'The flag keeps sessions for 30 minutes.',
  confidence: 0.9,
  cites: ['c1', 'c2'],
};

describe('golden checks', () => {
  it('flag invented and missing citations', () => {
    expect(answerCites('Sessions last 15 minutes.', offered)).toMatch(/without citing/);
    expect(answerCites('Sessions last 15 minutes [c9].', offered)).toMatch(/c9/);
    expect(answerCites('Sessions last 15 minutes [c1, c2].', offered)).toBeNull();
    expect(everyPointCites([{ text: 'A claim.', cites: [] }], offered)).toMatch(/unsourced/);
  });

  it('flag a plan that touches an issue nobody named', () => {
    const writes = new Set(['work_move_to_sprint']);
    const call = (key: string) => ({ toolName: 'work_move_to_sprint', input: { key } });
    expect(
      planTouchesOnly([call('PLT-211'), call('PLT-204')], writes, new Set(['PLT-211'])),
    ).toMatch(/PLT-204/);
    expect(planTouchesOnly([], writes, new Set(['PLT-211']))).toMatch(/no change/);
  });

  it('flag long or repeated ghost text, preambles and broken shapes', () => {
    expect(shortCompletion('one\ntwo', '')).toMatch(/second line/);
    expect(shortCompletion(Array(30).fill('word').join(' '), '')).toMatch(/30 words/);
    expect(noPreamble('Here is the summary:\nText')).toMatch(/preamble/);
    expect(markdownTable('| a | b |\n| c | d |')).not.toBeNull();
    expect(taskList('- [ ] Do it', 8)).toMatch(/Title — detail/);
    expect(attributedBullets('- Who owns step 4?', ['Jonas M.'])).toMatch(/who raised it/);
  });

  it('count a minimal diff by words', () => {
    expect(changedWords('valid for 15 minutes', 'valid for 30 minutes')).toBe(2);
    expect(
      minimalDiff('valid for 15 minutes', 'Sessions now last thirty whole minutes', 3),
    ).toMatch(/changed/);
  });

  it('flag a missed or invented conflict', () => {
    expect(findsRollbackConflict([conflict], offered)).toBeNull();
    expect(findsRollbackConflict([], offered)).toMatch(/missed/);
    expect(findsRollbackConflict([{ ...conflict, confidence: 0.2 }], offered)).toMatch(/rated/);
    expect(noOtherFindings([conflict, { ...conflict, issueKey: 'PLT-218' }])).toMatch(/PLT-218/);
  });
});
