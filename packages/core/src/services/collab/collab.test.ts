import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { applyUpdate, Doc, encodeStateAsUpdate, encodeStateVector, mergeUpdates } from 'yjs';
import type { Actor } from '../../contracts/authz.ts';
import { createMessageLimiter, messageKindOf } from './limits.ts';
import { resolveDocumentName, type HostedDocument } from './names.ts';
import { createUpdateWriter } from './writer.ts';

const logger = pino({ level: 'silent' });
const alice: Actor = { kind: 'user', id: 'alice' };
const bob: Actor = { kind: 'user', id: 'bob' };

/** One edit's update, made the way a client makes them: as a diff on its own document. */
function edit(doc: Doc, text: string): Uint8Array {
  const before = encodeStateVector(doc);
  doc.getText('body').insert(doc.getText('body').length, text);
  return encodeStateAsUpdate(doc, before);
}

describe('update writer', () => {
  it('stores in order, merging the updates one actor queued while a store ran', async () => {
    const calls: { actor: string | null; text: string }[] = [];
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const writer = createUpdateWriter({
      logger,
      store: async (_name, update, actor) => {
        if (calls.length === 0) await gate;
        const doc = new Doc();
        applyUpdate(doc, update);
        calls.push({ actor: actor?.id ?? null, text: doc.getText('body').toString() });
      },
    });
    const source = new Doc();
    writer.push('n', edit(source, 'a'), alice);
    writer.push('n', edit(source, 'b'), alice);
    writer.push('n', edit(source, 'c'), alice);
    writer.push('n', edit(source, 'd'), bob);
    release();
    await writer.flush();
    expect(calls.map((call) => call.actor)).toEqual(['alice', 'alice', 'bob']);
    expect(writer.pendingCount()).toBe(0);
  });

  it('retries a failed store instead of skipping it', async () => {
    const stored: Uint8Array[] = [];
    let failures = 2;
    const writer = createUpdateWriter({
      logger,
      sleep: async () => undefined,
      store: async (_name, update) => {
        if (failures-- > 0) throw new Error('database unavailable');
        stored.push(update);
      },
    });
    const source = new Doc();
    writer.push('n', edit(source, 'hello'), alice);
    await writer.flush('n');
    const doc = new Doc();
    applyUpdate(doc, mergeUpdates(stored));
    expect(doc.getText('body').toString()).toBe('hello');
  });
});

describe('message limiter', () => {
  it('refuses oversized messages and more messages than the window allows', () => {
    let now = 0;
    const limiter = createMessageLimiter(
      { maxMessageBytes: 10, messagesPerWindow: 2, windowMs: 1_000 },
      () => now,
    );
    expect(limiter.check(11)).toBe('too-big');
    expect(limiter.check(5)).toBe('ok');
    expect(limiter.check(5)).toBe('ok');
    expect(limiter.check(5)).toBe('rate-limited');
    now = 1_000;
    expect(limiter.check(5)).toBe('ok');
  });

  it('gives awareness a budget of its own, so carets never spend the typing budget', () => {
    let now = 0;
    const limiter = createMessageLimiter(
      { maxMessageBytes: 10, messagesPerWindow: 2, windowMs: 1_000 },
      () => now,
    );
    for (let i = 0; i < 6; i += 1) expect(limiter.check(5, 'awareness')).toBe('ok');
    expect(limiter.check(5, 'document')).toBe('ok');
    expect(limiter.check(5, 'document')).toBe('ok');
    // Three times the document budget, then a flood of carets closes the socket too.
    expect(limiter.check(5, 'awareness')).toBe('rate-limited');
    expect(limiter.check(5, 'document')).toBe('rate-limited');
    now = 1_000;
    expect(limiter.check(5, 'awareness')).toBe('ok');
  });

  it('reads the message type after the document name', () => {
    const varUint = (value: number): number[] =>
      value < 0x80 ? [value] : [(value & 0x7f) | 0x80, ...varUint(value >>> 7)];
    const message = (name: string, type: number) => {
      const bytes = new TextEncoder().encode(name);
      return Uint8Array.from([...varUint(bytes.length), ...bytes, type, 0]);
    };
    expect(messageKindOf(message('docs.page:0193', 1))).toBe('awareness');
    expect(messageKindOf(message('docs.page:0193', 0))).toBe('document');
    expect(messageKindOf(message(`docs.page:${'é'.repeat(100)}`, 1))).toBe('awareness');
    expect(messageKindOf(Uint8Array.from([0xff]))).toBe('document');
    expect(messageKindOf(new Uint8Array())).toBe('document');
  });
});

describe('document names', () => {
  const documents = [{ kind: 'docs.page', moduleId: 'docs' } as HostedDocument];

  it('splits kind and id at the last colon', () => {
    const { definition, id } = resolveDocumentName('docs.page:0193-abc', documents);
    expect(definition.kind).toBe('docs.page');
    expect(id).toBe('0193-abc');
  });

  it('rejects unknown kinds and ids with separators or slashes', () => {
    for (const name of ['work.issue:1', 'docs.page:', 'docs.page:a/b', 'docs.page', ':x']) {
      expect(() => resolveDocumentName(name, documents)).toThrow('No such document');
    }
  });
});
