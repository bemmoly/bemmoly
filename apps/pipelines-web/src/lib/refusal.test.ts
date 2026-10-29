import { ApiError } from '@bemmoly/api-client';
import { describe, expect, it } from 'vitest';
import { refusalOf, sentenceOf } from './refusal.ts';

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

describe('sentenceOf', () => {
  it('passes on the server sentence for a clash or a broken rule', () => {
    const clash = new ApiError(409, 'conflict', 'An environment called dev exists already');
    expect(sentenceOf(clash)).toBe('An environment called dev exists already');
    const rule = new ApiError(400, 'validation_failed', 'acme-prod failed its last check');
    expect(sentenceOf(rule)).toBe('acme-prod failed its last check');
  });

  it('says nothing of its own for failures that are not about the request', () => {
    expect(sentenceOf(new ApiError(500, 'internal_error', 'boom'))).toBeNull();
    expect(sentenceOf(new Error('offline'))).toBeNull();
  });
});
