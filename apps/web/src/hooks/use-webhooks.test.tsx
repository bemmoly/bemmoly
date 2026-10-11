import { WEBHOOK_EVENTS, WEBHOOK_FORMATS } from '@bemmoly/shared';
import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WEBHOOK_IDS } from '../mocks/seed/webhooks.ts';
import { renderQueryHook } from '../test/render.tsx';
import {
  EMPTY_WEBHOOK,
  formatPreview,
  groupEvents,
  toWebhookBody,
  useWebhookForm,
} from './use-webhook-form.ts';
import {
  attemptLabel,
  durationLabel,
  eventLabel,
  urlHost,
  useWebhook,
  useWebhooks,
} from './use-webhooks.ts';

describe('webhook words', () => {
  it('names hosts, attempts, durations and events as people read them', () => {
    expect(urlHost('https://chat.acmelabs.dev/hooks/x')).toBe('chat.acmelabs.dev');
    expect(urlHost('not a url')).toBe('not a url');
    expect(attemptLabel({ attempt: 0, maxAttempts: 6 })).toBe('1 of 6');
    expect(durationLabel(140)).toBe('140 ms');
    expect(durationLabel(1250)).toBe('1.3 s');
    expect(durationLabel(null)).toBeNull();
    expect(eventLabel('ping')).toBe('Test send');
    expect(eventLabel('issue.created')).toBe('Issue created');
  });

  it('offers only the events of modules that are on', () => {
    const groups = groupEvents(WEBHOOK_EVENTS, [{ id: 'work', name: 'Work' }]);
    expect(groups.map((group) => group.label)).toEqual(['Work']);
    expect(
      groups[0]?.events.every(
        (event) => event.kind.startsWith('issue.') || event.kind.startsWith('sprint.'),
      ),
    ).toBe(true);
  });

  it('previews a chat preset with its placeholders and the envelope for JSON', () => {
    const chat = WEBHOOK_FORMATS.find((preset) => preset.id === 'chat_text')!;
    expect(formatPreview(chat)).toContain('{{summary}}');
    expect(formatPreview({ template: null })).toContain('"version": "1"');
  });

  it('trims what the form sends', () => {
    expect(
      toWebhookBody({ ...EMPTY_WEBHOOK, name: ' Ops ', url: ' https://x.dev ' }),
    ).toMatchObject({
      name: 'Ops',
      url: 'https://x.dev',
    });
  });
});

describe('webhook hooks', () => {
  it('lists the workspace webhooks', async () => {
    const { result } = await renderQueryHook(() => useWebhooks());
    await waitFor(() => expect(result.current.webhooks).toHaveLength(3));
  });

  it('turns a failing webhook back on at once', async () => {
    const { result } = await renderQueryHook(() => useWebhook(WEBHOOK_IDS.billing));
    await waitFor(() => expect(result.current.webhook?.status).toBe('failing'));
    act(() => result.current.setEnabled.mutate(true));
    await waitFor(() => expect(result.current.webhook?.status).toBe('active'));
  });

  it('sends a test and keeps its answer for the page', async () => {
    const { result } = await renderQueryHook(() => useWebhook(WEBHOOK_IDS.chat));
    await waitFor(() => expect(result.current.webhook).toBeDefined());
    act(() => result.current.ping.mutate());
    await waitFor(() => expect(result.current.test?.status).toBe('succeeded'));
  });

  it('refuses a form with no events in the server’s words, then creates with the secret', async () => {
    const { result } = await renderQueryHook(() => useWebhookForm(null, () => undefined));
    act(() => result.current.update({ name: 'Ops', url: 'https://ops.acmelabs.dev/in' }));
    act(() => result.current.submit());
    expect(result.current.errors['events']).toBe('Pick at least one event');
    act(() => result.current.toggleEvent('issue.created'));
    act(() => result.current.submit());
    await waitFor(() => expect(result.current.created?.secret).toMatch(/^whsec_/));
  });
});
