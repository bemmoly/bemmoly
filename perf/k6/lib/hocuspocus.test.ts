import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import {
  authMessage,
  decoder,
  documentName,
  MESSAGE,
  readFrame,
  SYNC,
  syncStep1,
  typist,
} from './hocuspocus.js';

const DOC = documentName('01a119e1-2f29-7088-8bab-d28391f30fd6');

/** Strips the frame header and returns the Yjs update a sync-update frame carries. */
function updateOf(message: Uint8Array): Uint8Array {
  const d = decoder(message);
  expect(d.string()).toBe(DOC);
  expect(d.uint()).toBe(MESSAGE.sync);
  expect(d.uint()).toBe(SYNC.update);
  return d.array();
}

describe('hocuspocus wire', () => {
  it('frames auth and sync step 1 as the provider does', () => {
    const prefix = [DOC.length, ...Buffer.from(DOC)];
    expect([...authMessage(DOC)]).toEqual([...prefix, 2, 0, 0]);
    expect([...syncStep1(DOC)]).toEqual([...prefix, 0, 0, 1, 0]);
  });

  it('types into the page the way the editor stores it', () => {
    const doc = new Y.Doc();
    const writer = typist(DOC, 4242);
    Y.applyUpdate(doc, updateOf(writer.start('hel').message));
    Y.applyUpdate(doc, updateOf(writer.type('lo').message));
    Y.applyUpdate(doc, updateOf(writer.type(' world').message));
    expect(doc.getXmlFragment('default').toString()).toBe('<paragraph>hello world</paragraph>');
  });

  it('keeps two typists apart and converges in any order', () => {
    const a = typist(DOC, 1001);
    const b = typist(DOC, 2002);
    const updates = [a.start('a'), b.start('b'), a.type('aa'), b.type('bb')].map((u) =>
      updateOf(u.message),
    );
    const forward = new Y.Doc();
    const backward = new Y.Doc();
    for (const update of updates) Y.applyUpdate(forward, update);
    for (const update of [...updates].reverse()) Y.applyUpdate(backward, update);
    const text = forward.getXmlFragment('default').toString();
    expect(text).toContain('<paragraph>aaa</paragraph>');
    expect(text).toContain('<paragraph>bbb</paragraph>');
    expect(backward.getXmlFragment('default').toString()).toBe(text);
  });

  it('reads who typed an update off the frame', () => {
    const writer = typist(DOC, 777);
    writer.start('x');
    const sent = writer.type('y');
    expect(readFrame(sent.message)).toMatchObject({
      doc: DOC,
      type: MESSAGE.sync,
      sync: SYNC.update,
      client: 777,
      clock: sent.clock,
    });
  });

  it('reads the clock range of a broadcast that merged neighbouring keystrokes', () => {
    const writer = typist(DOC, 31337);
    const updates = [writer.start('a'), writer.type('b'), writer.type('cd')].map((u) =>
      updateOf(u.message),
    );
    const merged = Y.mergeUpdates(updates.slice(1));
    const frame = Uint8Array.from([
      DOC.length,
      ...Buffer.from(DOC),
      0,
      2,
      merged.length,
      ...merged,
    ]);
    expect(readFrame(frame)).toMatchObject({ client: 31337, clock: 3, lastClock: 5 });
    expect(readFrame(writer.start('xyz').message)).toMatchObject({ clock: 0, lastClock: 4 });
  });

  it('reads a snapshot and an auth answer', () => {
    const doc = new Y.Doc();
    doc.getText('t').insert(0, 'snapshot');
    const state = Y.encodeStateAsUpdate(doc);
    const step2 = Uint8Array.from([DOC.length, ...Buffer.from(DOC), 0, 1, state.length, ...state]);
    expect(readFrame(step2)).toMatchObject({ sync: SYNC.step2, snapshotBytes: state.length });
    const scope = 'read-write';
    const auth = Uint8Array.from([
      DOC.length,
      ...Buffer.from(DOC),
      2,
      2,
      scope.length,
      ...Buffer.from(scope),
    ]);
    expect(readFrame(auth)).toMatchObject({ type: MESSAGE.auth, auth: 2, scope });
  });
});
