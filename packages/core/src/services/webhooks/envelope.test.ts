import { describe, expect, it } from 'vitest';
import { backoffSeconds } from './context.ts';
import { envelopeFor, renderBody } from './envelope.ts';
import { signWebhook, verifyWebhookSignature } from './signing.ts';

const event = {
  kind: 'sprint.completed',
  occurredAt: new Date('2026-10-11T09:00:00Z'),
  entity: { kind: 'sprint', id: 'sprint-1' },
  payload: { summary: 'Sprint 14 completed', url: '/work/board?sprint=1', velocity: 21 },
};

describe('webhook envelopes', () => {
  const envelope = envelopeFor(event, '0199c7a0-0000-7000-8000-00000000000a', 'https://b.test');

  it('splits the summary and link from the module’s own data', () => {
    expect(envelope).toEqual({
      version: '1',
      id: '0199c7a0-0000-7000-8000-00000000000a',
      event: 'sprint.completed',
      occurredAt: '2026-10-11T09:00:00.000Z',
      workspace: { url: 'https://b.test' },
      actor: null,
      entity: { kind: 'sprint', id: 'sprint-1' },
      summary: 'Sprint 14 completed',
      url: 'https://b.test/work/board?sprint=1',
      data: { velocity: 21 },
    });
  });

  it('falls back to the event’s name when a payload carries no summary', () => {
    expect(envelopeFor({ ...event, payload: { id: 1 } }, 'x', 'https://b.test')).toMatchObject({
      summary: 'Sprint completed',
      url: null,
      data: { id: 1 },
    });
  });

  it('renders each chat preset from the envelope, with no tool-specific code', () => {
    expect(JSON.parse(renderBody('json', envelope))).toEqual(envelope);
    expect(JSON.parse(renderBody('chat_text', envelope))).toEqual({
      text: 'Sprint 14 completed\nhttps://b.test/work/board?sprint=1',
    });
    expect(JSON.parse(renderBody('chat_blocks', envelope)).blocks[0].text.text).toBe(
      '*Sprint completed*\n<https://b.test/work/board?sprint=1|Sprint 14 completed>',
    );
    expect(JSON.parse(renderBody('chat_card', envelope))).toMatchObject({
      title: 'Sprint completed',
      text: 'Sprint 14 completed',
      potentialAction: [{ targets: [{ uri: 'https://b.test/work/board?sprint=1' }] }],
    });
  });

  it('backs off exponentially: 30 s, 2, 8 and 32 minutes, then about two hours', () => {
    expect([1, 2, 3, 4, 5].map(backoffSeconds)).toEqual([30, 120, 480, 1920, 7680]);
  });

  it('signs the timestamp with the raw body', () => {
    const now = new Date('2026-10-11T09:00:00Z');
    const header = signWebhook('whsec_a', now.getTime() / 1000, '{"a":1}');
    expect(header).toMatch(/^t=1791709200,v1=[0-9a-f]{64}$/);
    expect(verifyWebhookSignature('whsec_a', header, '{"a":1}', { now })).toBe(true);
    expect(verifyWebhookSignature('whsec_a', header, '{"a":2}', { now })).toBe(false);
    const later = new Date(now.getTime() + 301_000);
    expect(verifyWebhookSignature('whsec_a', header, '{"a":1}', { now: later })).toBe(false);
  });
});
