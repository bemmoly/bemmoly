import { describe, expect, it } from 'vitest';
import { findIssueKeys, MAX_KEYS_PER_TEXT } from './code-links.ts';

describe('issue keys in code host text', () => {
  it('finds a key in a lower-case branch name', () => {
    expect(findIssueKeys(['feat/plt-204-pg-sessions'])).toEqual(['PLT-204']);
  });

  it('finds keys in titles, bodies and commit messages, in reading order, once each', () => {
    expect(
      findIssueKeys([
        'PLT-204: move sessions to Postgres',
        'Part of PLT-204. Unblocks OPS-12 and (WEB2-7).',
        'Fixes plt-204',
      ]),
    ).toEqual(['PLT-204', 'OPS-12', 'WEB2-7']);
  });

  it('takes keys between punctuation, brackets and line ends', () => {
    expect(findIssueKeys(['[PLT-1] fix', 'see PLT-2,PLT-3;', 'end PLT-4\nnext'])).toEqual([
      'PLT-1',
      'PLT-2',
      'PLT-3',
      'PLT-4',
    ]);
  });

  it('ignores what only looks like a key', () => {
    expect(
      findIssueKeys([
        'XPLT-204',
        'PLT-0 and PLT-012',
        'a sha 3f2e-12',
        'P-12',
        'TOOLONGPROJ1-5',
        'PLT204',
        'PLT-',
      ]),
    ).toEqual(['XPLT-204']);
  });

  it('does not run a key on into the next word or number', () => {
    expect(findIssueKeys(['PLT-12a', 'PLT-12-follow-up', 'mid_PLT-9'])).toEqual([
      'PLT-12',
      'PLT-9',
    ]);
  });

  it('stops reading one text after its first twenty keys', () => {
    const changelog = Array.from({ length: 30 }, (_, index) => `PLT-${index + 1}`).join(' ');
    expect(findIssueKeys([changelog])).toHaveLength(MAX_KEYS_PER_TEXT);
  });

  it('finds nothing in empty texts', () => {
    expect(findIssueKeys([])).toEqual([]);
    expect(findIssueKeys(['', 'no keys here'])).toEqual([]);
  });
});
