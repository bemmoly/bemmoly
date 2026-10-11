/*
 * The page over /collab, as the editor uses it: open (connect, authenticate with the session
 * cookie, receive the snapshot) and two people typing into the same page, each watching the
 * other's keystrokes arrive.
 */
import { Counter, Rate, Trend } from 'k6/metrics';
import { clearInterval, clearTimeout, setInterval, setTimeout } from 'k6/timers';
import { WebSocket } from 'k6/websockets';
import { COLLAB_URL, collabHeaders } from './config.js';
import {
  AUTH,
  authMessage,
  documentName,
  MESSAGE,
  readFrame,
  SYNC,
  syncStep1,
  typist,
} from './hocuspocus.js';

/** Connect, authenticate and receive the snapshot: §20's "page open", the collab half. */
export const pageOpenTime = new Trend('collab_page_open', true);
/** A keystroke from one person until it reaches the other person's socket. */
export const remoteEcho = new Trend('collab_remote_echo', true);
/** A keystroke until the server's sync-status answer to the person who typed it. */
export const ackTime = new Trend('collab_ack', true);
/** Share of keystrokes that reached the other person. */
export const delivered = new Rate('collab_delivered');
export const collabErrors = new Counter('collab_errors');

/** Why a collab attempt failed, as `collab_errors{reason:…}` tags. */
export const COLLAB_ERROR_REASONS = ['open_timeout', 'denied', 'socket_error', 'pair_not_ready'];

/**
 * No collab errors at all, plus one report-only threshold per reason, which is how k6 puts
 * the breakdown in the summary.
 */
export const collabErrorThresholds = () => ({
  collab_errors: ['count<1'],
  ...Object.fromEntries(
    COLLAB_ERROR_REASONS.map((reason) => [`collab_errors{reason:${reason}}`, ['count>=0']]),
  ),
});
/** Broadcasts that carried more than one keystroke (the server merged neighbours). */
export const mergedFrames = new Counter('collab_merged_frames');

const OPEN_TIMEOUT_MS = 10_000;

/**
 * Opens a page over /collab. `onSynced(ws, frameHandler)` runs once the snapshot arrived;
 * the caller can install `ws.onFrame` to see every later frame. Returns the socket.
 */
export function openPage(person, pageId, { onSynced, onFrame, closeWhenSynced = false }) {
  const doc = documentName(pageId);
  const started = Date.now();
  const ws = new WebSocket(COLLAB_URL, null, {
    headers: collabHeaders(person),
    tags: { endpoint: 'collab' },
  });
  ws.binaryType = 'arraybuffer';
  let synced = false;
  const timeout = setTimeout(() => {
    if (synced) return;
    collabErrors.add(1, { reason: 'open_timeout' });
    ws.close();
  }, OPEN_TIMEOUT_MS);
  ws.onopen = () => {
    ws.send(authMessage(doc).buffer);
    ws.send(syncStep1(doc).buffer);
  };
  ws.onmessage = (event) => {
    if (typeof event.data === 'string') return;
    const frame = readFrame(event.data);
    if (frame.type === MESSAGE.auth && frame.auth === AUTH.denied) {
      collabErrors.add(1, { reason: 'denied' });
      ws.close();
      return;
    }
    if (!synced && frame.type === MESSAGE.sync && frame.sync === SYNC.step2) {
      synced = true;
      clearTimeout(timeout);
      pageOpenTime.add(Date.now() - started);
      if (closeWhenSynced) ws.close();
      else if (onSynced) onSynced(ws, doc);
      return;
    }
    if (onFrame) onFrame(frame);
  };
  ws.onerror = () => {
    collabErrors.add(1, { reason: 'socket_error' });
  };
  return ws;
}

/**
 * Two people on one page, typing at once for `seconds`, a keystroke every `keyMs` each.
 * Measures each keystroke's trip to the other person and the server's acknowledgement.
 */
export function typeTogether(pair, pageId, { seconds = 30, keyMs = 150 } = {}) {
  const sides = pair.map(() => ({ ws: null, writer: null, pendingAcks: [], sent: [] }));
  let ready = 0;
  const finish = () => {
    for (const side of sides) {
      for (let missed = side.sent.length; missed > 0; missed -= 1) delivered.add(false);
      side.sent = [];
      if (side.ws) side.ws.close();
    }
  };

  const start = () => {
    const text = 'the quick brown fox jumps over the lazy dog ';
    let at = 0;
    const timers = sides.map((side, index) =>
      setInterval(
        () => {
          const char = text[(at + index) % text.length];
          const keystroke = side.writer.started ? side.writer.type(char) : side.writer.start(char);
          side.writer.started = true;
          const now = Date.now();
          side.sent.push({ client: keystroke.client, clock: keystroke.clock, at: now });
          side.pendingAcks.push(now);
          side.ws.send(keystroke.message.buffer);
          at += 1;
        },
        keyMs + index * 7,
      ),
    );
    setTimeout(() => {
      timers.forEach((timer) => clearInterval(timer));
      // Let keystrokes in flight land before counting the ones that never did.
      setTimeout(finish, 1500);
    }, seconds * 1000);
  };

  setTimeout(() => {
    if (ready === sides.length) return;
    collabErrors.add(1, { reason: 'pair_not_ready' });
    finish();
  }, OPEN_TIMEOUT_MS + 1000);

  sides.forEach((side, index) => {
    const other = sides[1 - index];
    side.ws = openPage(pair[index], pageId, {
      onSynced: (_ws, doc) => {
        side.writer = typist(doc);
        ready += 1;
        if (ready === sides.length) start();
      },
      onFrame: (frame) => {
        if (frame.type === MESSAGE.syncStatus) {
          const sentAt = side.pendingAcks.shift();
          if (sentAt !== undefined) ackTime.add(Date.now() - sentAt);
          return;
        }
        if (frame.type !== MESSAGE.sync || frame.sync !== SYNC.update) return;
        // Keystrokes from one person arrive in order, and the server may merge neighbours
        // into one broadcast: a frame covering clocks k..m delivers every keystroke up to m,
        // each timed from when it was typed.
        if (frame.client !== other.writer?.client) return;
        let covered = 0;
        while (other.sent.length && other.sent[0].clock <= frame.lastClock) {
          remoteEcho.add(Date.now() - other.sent.shift().at);
          delivered.add(true);
          covered += 1;
        }
        if (covered > 1) mergedFrames.add(1);
      },
    });
  });
}
