/*
 * Just enough of the Hocuspocus 4 wire format (lib0 encoding over Yjs sync messages) for k6,
 * which has no Yjs: authenticate, ask for the document, read the snapshot, and type into the
 * page as the editor does, one keystroke per update. Pure functions on Uint8Array, so the
 * unit test checks every byte against the real Yjs.
 *
 * Frame: varString(documentName) varUint(type) payload. Types: 0 sync, 1 awareness, 2 auth,
 * 3 query awareness, 8 sync status. Sync payloads: 0 step 1, 1 step 2, 2 update.
 */

export const MESSAGE = { sync: 0, awareness: 1, auth: 2, queryAwareness: 3, syncStatus: 8 };
export const SYNC = { step1: 0, step2: 1, update: 2 };
export const AUTH = { token: 0, denied: 1, authenticated: 2 };

const encoder = () => {
  const bytes = [];
  const self = {
    uint(value) {
      let rest = value;
      while (rest > 0x7f) {
        bytes.push(0x80 | (rest & 0x7f));
        rest = Math.floor(rest / 128);
      }
      bytes.push(rest);
      return self;
    },
    byte(value) {
      bytes.push(value);
      return self;
    },
    raw(data) {
      for (const value of data) bytes.push(value);
      return self;
    },
    /** Length-prefixed UTF-8. The harness only sends ASCII, which is its own UTF-8. */
    string(value) {
      const data = Array.from(unescape(encodeURIComponent(value)), (c) => c.charCodeAt(0));
      return self.uint(data.length).raw(data);
    },
    array(data) {
      return self.uint(data.length).raw(data);
    },
    done: () => Uint8Array.from(bytes),
  };
  return self;
};

export function decoder(data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let at = 0;
  const self = {
    get done() {
      return at >= bytes.length;
    },
    byte() {
      const value = bytes[at];
      at += 1;
      if (value === undefined) throw new Error('truncated byte');
      return value;
    },
    uint() {
      let value = 0;
      let scale = 1;
      for (;;) {
        const byte = bytes[at];
        at += 1;
        if (byte === undefined) throw new Error('truncated varUint');
        value += (byte & 0x7f) * scale;
        if (byte < 0x80) return value;
        scale *= 128;
      }
    },
    array() {
      const length = self.uint();
      const out = bytes.subarray(at, at + length);
      at += length;
      return out;
    },
    string() {
      const raw = self.array();
      return decodeURIComponent(escape(String.fromCharCode(...raw)));
    },
  };
  return self;
}

export const documentName = (pageId) => `docs.page:${pageId}`;

/** Auth comes first on every document; the server reads the actor from the session cookie. */
export const authMessage = (doc) =>
  encoder().string(doc).uint(MESSAGE.auth).uint(AUTH.token).string('').done();

/** Sync step 1 with an empty state vector: "send me the whole document". */
export const syncStep1 = (doc) =>
  encoder().string(doc).uint(MESSAGE.sync).uint(SYNC.step1).array([0]).done();

export const queryAwareness = (doc) => encoder().string(doc).uint(MESSAGE.queryAwareness).done();

const updateMessage = (doc, update) =>
  encoder().string(doc).uint(MESSAGE.sync).uint(SYNC.update).array(update).done();

/** A Yjs client id: 30 random bits, as Yjs makes them. */
export const newClientId = () => Math.floor(Math.random() * 0x3fffffff) + 1;

/**
 * One typist: a fresh Yjs client that owns a paragraph at the top of the page and appends
 * to it. `start()` inserts <paragraph>first</paragraph> (clocks 0..2+n), `type(text)` appends
 * text after the last character. Each returns { message, client, clock } where clock is the
 * first clock of the update, the key the far side sees it by.
 */
export function typist(doc, client = newClientId()) {
  let next = 0;
  let last = -1;
  return {
    client,
    start(first) {
      const update = encoder()
        .uint(1)
        .uint(3)
        .uint(client)
        .uint(0)
        // Item: ContentType, parent the root type "default", an XmlElement "paragraph".
        .byte(0x07)
        .uint(1)
        .string('default')
        .uint(3)
        .string('paragraph')
        // Item: ContentType, parent the paragraph, an XmlText.
        .byte(0x07)
        .uint(0)
        .uint(client)
        .uint(0)
        .uint(6)
        // Item: ContentString, parent the XmlText.
        .byte(0x04)
        .uint(0)
        .uint(client)
        .uint(1)
        .string(first)
        .uint(0)
        .done();
      next = 2 + first.length;
      last = next - 1;
      return { message: updateMessage(doc, update), client, clock: 0 };
    },
    type(text) {
      if (last < 0) throw new Error('start() before type()');
      const clock = next;
      // Item: ContentString with its left origin the last character typed (info 0x84).
      const update = encoder()
        .uint(1)
        .uint(1)
        .uint(client)
        .uint(clock)
        .byte(0x84)
        .uint(client)
        .uint(last)
        .string(text)
        .uint(0)
        .done();
      next += text.length;
      last = next - 1;
      return { message: updateMessage(doc, update), client, clock };
    },
  };
}

/** Length in clock units of one struct, reading past it; null for content this file never sends. */
function structLength(u) {
  const skipId = () => {
    u.uint();
    u.uint();
  };
  const info = u.byte();
  if (info & 0x80) skipId();
  if (info & 0x40) skipId();
  if (!(info & 0xc0)) {
    if (u.uint() === 1) u.string();
    else skipId();
    if (info & 0x20) u.string();
  }
  const ref = info & 0x1f;
  if (ref === 7) {
    const type = u.uint();
    if (type === 3 || type === 5) u.string();
    return 1;
  }
  if (ref === 4) return u.string().length;
  return null;
}

/**
 * Whose keystrokes an update carries: the first client's id, its first clock, and its last
 * clock when every struct is one this file writes. The server may merge neighbouring
 * keystrokes into one broadcast, so one frame can cover several.
 */
function structRange(payload) {
  const u = decoder(payload);
  if (u.uint() === 0) return {};
  const structs = u.uint();
  const client = u.uint();
  const clock = u.uint();
  let next = clock;
  try {
    for (let i = 0; i < structs; i += 1) {
      const length = structLength(u);
      if (length === null) return { client, clock, lastClock: clock };
      next += length;
    }
  } catch {
    return { client, clock, lastClock: clock };
  }
  return { client, clock, lastClock: next - 1 };
}

/**
 * Reads one server frame. For a sync update it also reads the first struct header, which
 * says whose keystrokes it carries: { doc, type, sync, client, clock, lastClock }. For auth, `auth` and
 * `scope`; for a sync step 2, `snapshotBytes`.
 */
export function readFrame(data) {
  const d = decoder(data);
  const frame = { doc: d.string(), type: d.uint() };
  if (frame.type === MESSAGE.auth) {
    frame.auth = d.uint();
    if (!d.done) frame.scope = d.string();
  } else if (frame.type === MESSAGE.sync) {
    frame.sync = d.uint();
    const payload = d.array();
    if (frame.sync === SYNC.step2) frame.snapshotBytes = payload.length;
    if (frame.sync === SYNC.update && payload.length > 3)
      Object.assign(frame, structRange(payload));
  } else if (frame.type === MESSAGE.syncStatus) {
    frame.synced = d.uint() === 1;
  }
  return frame;
}
