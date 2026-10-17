import { ApiError } from '@bemmoly/api-client';
import { describe, expect, it } from 'vitest';
import { refusalOf } from './refusal.ts';

const forbidden = (details: unknown) => new ApiError(403, 'forbidden', 'Refused', { details });

describe('refusalOf', () => {
  it('reads the sentence and who to ask from the access contract', () => {
    const refusal = refusalOf(
      forbidden({
        action: 'run',
        sentence: 'Sam has no role on checkout-api.',
        trace: [],
        askWho: { teams: [], label: 'Ask Payments for access' },
      }),
    );
    expect(refusal).toEqual({
      sentence: 'Sam has no role on checkout-api.',
      askWho: 'Ask Payments for access',
    });
  });

  it('treats anything else as an ordinary failure', () => {
    expect(refusalOf(forbidden({ unrelated: true }))).toBeNull();
    expect(refusalOf(new Error('offline'))).toBeNull();
  });
});
