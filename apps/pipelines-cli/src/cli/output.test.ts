import { describe, expect, it } from 'vitest';
import { decisionLines, errorLines } from './output.ts';
import { CliError } from './errors.ts';

const trace = [
  {
    kind: 'binding' as const,
    text: 'All engineering: Viewer at Acme',
    effect: 'grant' as const,
    ref: null,
  },
  {
    kind: 'policy' as const,
    text: 'Tier 0 to Prod: requester must match has_role("maintainer")',
    effect: 'deny' as const,
    ref: null,
  },
];
const askWho = {
  teams: [{ id: '0190a1b2-0000-7000-8000-000000000001', name: 'Payments' }],
  label: 'Ask Payments for access',
};

describe('output', () => {
  it('prints a decision with its numbered trace and whom to ask', () => {
    expect(
      decisionLines({
        allowed: false,
        sentence: 'Tier 0 to Prod needs a Maintainer to request it.',
        trace,
        askWho,
        decisionId: null,
      }),
    ).toEqual([
      'Not allowed',
      'Tier 0 to Prod needs a Maintainer to request it.',
      '',
      'Why:',
      '  1. All engineering: Viewer at Acme (grants)',
      '  2. Tier 0 to Prod: requester must match has_role("maintainer") (refuses)',
      '',
      'Ask Payments for access.',
    ]);
  });

  it('explains a refusal from the API from its details', () => {
    const error = new CliError('Jon may not deploy.', {
      status: 403,
      body: {
        code: 'forbidden',
        message: 'Jon may not deploy.',
        requestId: 'r-1',
        details: { action: 'deploy', sentence: 'Jon may not deploy.', trace, askWho },
      },
    });
    expect(errorLines(error)).toEqual([
      'Jon may not deploy.',
      '',
      'Why:',
      '  1. All engineering: Viewer at Acme (grants)',
      '  2. Tier 0 to Prod: requester must match has_role("maintainer") (refuses)',
      '',
      'Ask Payments for access.',
      'Request id: r-1',
    ]);
  });

  it('says how to sign in after a 401', () => {
    const error = new CliError('Sign in to continue', { status: 401 });
    expect(errorLines(error)).toEqual([
      'Sign in to continue',
      'Sign in with "bp login", or pass --token.',
    ]);
  });
});
