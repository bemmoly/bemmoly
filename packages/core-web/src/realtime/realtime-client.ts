import { realtimeServerMessageSchema, type RealtimeServerMessage } from '@bemmoly/shared';

export type RealtimeStatus = 'connecting' | 'open' | 'closed';
export type RealtimeEvent = Extract<RealtimeServerMessage, { type: 'event' }>;

export interface BackoffOptions {
  initialMs: number;
  maxMs: number;
}

const DEFAULT_BACKOFF: BackoffOptions = { initialMs: 500, maxMs: 30_000 };

/** Exponential backoff with jitter between half and the full delay, capped at `maxMs`. */
export function backoffDelay(
  attempt: number,
  options: BackoffOptions = DEFAULT_BACKOFF,
  random: () => number = Math.random,
): number {
  const ceiling = Math.min(options.maxMs, options.initialMs * 2 ** attempt);
  return Math.round(ceiling * (0.5 + random() / 2));
}

type SocketFactory = (url: string) => WebSocket;

export interface RealtimeClientOptions {
  url: string;
  scopes: readonly string[];
  onEvent: (event: RealtimeEvent) => void;
  onStatus?: (status: RealtimeStatus) => void;
  backoff?: BackoffOptions;
  createSocket?: SocketFactory;
  setTimer?: (callback: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

/**
 * One socket to /ws per tab. Events carry ids only; listeners invalidate
 * queries so data always comes back through the authenticated REST API.
 */
export class RealtimeClient {
  private socket: WebSocket | null = null;
  private attempt = 0;
  private timer: unknown = null;
  private stopped = true;
  private readonly options: Required<Omit<RealtimeClientOptions, 'onStatus'>> &
    Pick<RealtimeClientOptions, 'onStatus'>;

  constructor(options: RealtimeClientOptions) {
    this.options = {
      backoff: DEFAULT_BACKOFF,
      createSocket: (url) => new WebSocket(url),
      setTimer: (callback, ms) => setTimeout(callback, ms),
      clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
      ...options,
    };
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer !== null) this.options.clearTimer(this.timer);
    this.timer = null;
    const socket = this.socket;
    this.socket = null;
    socket?.close();
    this.options.onStatus?.('closed');
  }

  private connect(): void {
    this.options.onStatus?.('connecting');
    let socket: WebSocket;
    try {
      socket = this.options.createSocket(this.options.url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;
    socket.addEventListener('open', () => {
      this.attempt = 0;
      this.options.onStatus?.('open');
      socket.send(JSON.stringify({ type: 'subscribe', scopes: this.options.scopes }));
    });
    socket.addEventListener('message', (message: MessageEvent) => this.receive(message.data));
    socket.addEventListener('close', () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.options.onStatus?.('closed');
      this.scheduleReconnect();
    });
  }

  private receive(data: unknown): void {
    if (typeof data !== 'string') return;
    let json: unknown;
    try {
      json = JSON.parse(data);
    } catch {
      return;
    }
    const parsed = realtimeServerMessageSchema.safeParse(json);
    if (parsed.success && parsed.data.type === 'event') this.options.onEvent(parsed.data);
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    const delay = backoffDelay(this.attempt, this.options.backoff);
    this.attempt += 1;
    this.timer = this.options.setTimer(() => {
      this.timer = null;
      if (!this.stopped) this.connect();
    }, delay);
  }
}
