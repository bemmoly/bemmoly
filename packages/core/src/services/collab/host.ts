import type { IncomingHttpHeaders } from 'node:http';
import { Hocuspocus } from '@hocuspocus/server';
import { ForbiddenError, isBemmolyError, NotFoundError } from '@bemmoly/shared';
import type { RawData, WebSocket } from 'ws';
import { applyUpdate } from 'yjs';
import type { Logger } from '../../config/logger.ts';
import type { Actor } from '../../contracts/authz.ts';
import type { CollabAccess, CollabTransactor } from '../../modules/collab.ts';
import type { RequestContext } from '../authz/index.ts';
import {
  CLOSE_RATE_LIMITED,
  CLOSE_TOO_BIG,
  createMessageLimiter,
  DEFAULT_COLLAB_LIMITS,
  type CollabLimits,
} from './limits.ts';
import { resolveDocumentName, type HostedDocument } from './names.ts';
import { createUpdateWriter } from './writer.ts';

interface Context {
  actor: Actor | null;
}

export interface CollabHostOptions {
  /** Every module's document kinds; read on each open, so it follows the registry. */
  documents: () => readonly HostedDocument[];
  /** A request context for the person behind a socket: actor plus a fresh authz cache. */
  contextFor: (actor: Actor) => RequestContext;
  /** Live enabled state; a disabled module's documents do not open. */
  isEnabled?: (moduleId: string) => boolean;
  logger: Logger;
  limits?: Partial<CollabLimits>;
  /** Quiet period before a definition's onChange runs; the tech design's 2 s. */
  changeDebounceMs?: number;
  /** onChange runs at least this often while someone keeps typing. */
  maxChangeDebounceMs?: number;
}

export interface CollabRequest {
  url: string;
  headers: IncomingHttpHeaders;
}

export interface CollabHost extends CollabTransactor {
  readonly limits: CollabLimits;
  /** Serves one authenticated socket; the caller has checked the session and the origin. */
  accept(socket: WebSocket, request: CollabRequest, actor: Actor): void;
  connections(): number;
  /** Closes every socket, runs pending onChange calls and stores every queued update. */
  stop(): Promise<void>;
}

const HIDDEN_HEADERS = new Set(['cookie', 'authorization']);

/** What hooks may see of the upgrade request: never the session cookie. */
function hookRequest(request: CollabRequest): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (value === undefined || HIDDEN_HEADERS.has(name)) continue;
    headers.set(name, Array.isArray(value) ? value.join(', ') : value);
  }
  return new Request(new URL(request.url, 'http://collab.invalid'), { headers });
}

/**
 * What a refused open sends the client: the error code as the reason (the provider's
 * onAuthenticationFailed receives it) and no message, so Hocuspocus does not print it to
 * stderr; the host has already logged it.
 */
function refusal(error: unknown): Error & { reason: string } {
  const reason = isBemmolyError(error) ? error.code : 'internal_error';
  return Object.assign(new Error(), { reason });
}

function bytesOf(data: RawData): Uint8Array {
  const buffer = Array.isArray(data) ? Buffer.concat(data) : data;
  return buffer instanceof ArrayBuffer
    ? new Uint8Array(buffer)
    : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

/**
 * The kernel's Hocuspocus, mounted on the API's own HTTP server: it authenticates nothing
 * itself (the upgrade route does) but checks module access and the module's own authorize
 * per document, persists every update through the module in order, and runs the module's
 * debounced onChange.
 */
export function createCollabHost(options: CollabHostOptions): CollabHost {
  const { logger } = options;
  const limits: CollabLimits = { ...DEFAULT_COLLAB_LIMITS, ...options.limits };
  const resolve = (name: string) => resolveDocumentName(name, options.documents());
  const writer = createUpdateWriter({
    logger,
    store: (name, update, actor) => {
      const { definition, id } = resolve(name);
      return definition.store(id, update, actor);
    },
  });
  const editors = new Map<string, Map<string, Actor>>();
  const running = new Set<Promise<void>>();
  let stopping = false;

  async function access(actor: Actor | null, name: string): Promise<CollabAccess> {
    if (!actor) throw new ForbiddenError('Sign in to open this document');
    const { definition, id } = resolve(name);
    if (options.isEnabled && !options.isEnabled(definition.moduleId)) {
      throw new NotFoundError(`The ${definition.moduleId} module is not enabled`);
    }
    const ctx = options.contextFor(actor);
    if (!(await ctx.authz.canAccess(actor, definition.moduleId))) {
      throw new ForbiddenError(`You do not have access to the ${definition.moduleId} module`, {
        code: 'module_access_denied',
      });
    }
    const verdict = await definition.authorize(ctx, id);
    if (verdict === 'deny') throw new ForbiddenError('You may not open this document');
    return verdict;
  }

  function noteEditor(name: string, actor: Actor | null): void {
    if (!actor) return;
    let seen = editors.get(name);
    if (!seen) {
      seen = new Map();
      editors.set(name, seen);
    }
    seen.set(`${actor.kind}:${actor.id}`, actor);
  }

  async function settle(name: string, doc: Parameters<typeof applyUpdate>[0]): Promise<void> {
    const { definition, id } = resolve(name);
    const changed = [...(editors.get(name)?.values() ?? [])];
    editors.delete(name);
    if (!definition.onChange) return;
    const run = definition.onChange({ id, doc, editors: changed }).catch((error: unknown) => {
      logger.error({ err: error, document: name }, 'a collaborative document change hook failed');
    });
    running.add(run);
    try {
      await run;
    } finally {
      running.delete(run);
    }
  }

  const hocuspocus = new Hocuspocus<Context>({
    name: 'bemmoly-collab',
    quiet: true,
    debounce: options.changeDebounceMs ?? 2_000,
    maxDebounce: options.maxChangeDebounceMs ?? 10_000,
    unloadImmediately: true,
    async onAuthenticate({ documentName, context, connectionConfig }) {
      try {
        const verdict = await access(context.actor, documentName);
        connectionConfig.readOnly = verdict === 'read';
      } catch (error) {
        const level = isBemmolyError(error) ? 'debug' : 'warn';
        logger[level]({ err: error, document: documentName }, 'collab document refused');
        throw refusal(error);
      }
    },
    async onLoadDocument({ documentName, document }) {
      try {
        await writer.flush(documentName);
        const { definition, id } = resolve(documentName);
        const stored = await definition.load(id);
        if (stored) applyUpdate(document, stored);
      } catch (error) {
        logger.warn({ err: error, document: documentName }, 'a collab document failed to load');
        throw refusal(error);
      }
    },
    async onChange({ documentName, update, context }) {
      const actor = context?.actor ?? null;
      writer.push(documentName, update, actor);
      noteEditor(documentName, actor);
    },
    async onStoreDocument({ documentName, document }) {
      await settle(documentName, document);
    },
  });

  return {
    limits,
    accept(socket, request, actor) {
      if (stopping) {
        socket.close(1001, 'server shutting down');
        return;
      }
      const limiter = createMessageLimiter(limits);
      const connection = hocuspocus.handleConnection(socket, hookRequest(request), { actor });
      socket.on('message', (data: RawData) => {
        const bytes = bytesOf(data);
        const verdict = limiter.check(bytes.byteLength);
        if (verdict !== 'ok') {
          const close = verdict === 'too-big' ? CLOSE_TOO_BIG : CLOSE_RATE_LIMITED;
          logger.warn(
            { actor: actor.id, bytes: bytes.byteLength, verdict },
            'collab socket closed',
          );
          socket.close(close.code, close.reason);
          return;
        }
        connection.handleMessage(bytes);
      });
      socket.on('close', (code: number, reason: Buffer) => {
        connection.handleClose({ code, reason: reason.toString() });
      });
      socket.on('error', (error: Error) => logger.warn({ err: error }, 'collab socket error'));
    },
    connections: () => hocuspocus.getConnectionsCount(),
    async transact(name, change, actor) {
      resolve(name);
      const direct = await hocuspocus.openDirectConnection(name, { actor });
      try {
        await direct.transact((doc) => change(doc));
      } finally {
        await direct.disconnect();
      }
      await writer.flush(name);
    },
    async stop() {
      stopping = true;
      hocuspocus.closeConnections();
      hocuspocus.flushPendingStores();
      // The flushed stores start after a turn of the event loop; wait for each to finish.
      do {
        await new Promise((resolve) => setTimeout(resolve, 0));
        await Promise.all(running);
      } while (running.size > 0);
      await writer.flush();
    },
  };
}
