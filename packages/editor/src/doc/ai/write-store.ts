import type { WriteScope } from './request.ts';
import type { AiCommand, AiHandler } from './types.ts';

/*
 * The suggestion card's state: which command is writing, the text streamed so far, and how it
 * ended. One card at a time; opening another, discarding or applying ends the one before and
 * aborts its stream. Where the card sits and what it would replace is the editor plugin's
 * (write-plugin.ts), since that has to follow every edit.
 */

export type AiWriteStatus = 'streaming' | 'done' | 'error';

export interface AiWriteSession {
  id: number;
  command: AiCommand;
  scope: WriteScope;
  status: AiWriteStatus;
  /** The Markdown written so far. */
  text: string;
  runId: string | null;
  /** Honest copy for a failure, shown in the card. */
  error: string | null;
  /** The block the card is drawn into, between the page's blocks. */
  container: HTMLElement;
}

const FAILED = 'Couldn’t write that. Try again in a moment.';

export class AiWriteStore {
  private session: AiWriteSession | null = null;
  private controller: AbortController | null = null;
  private count = 0;
  private readonly listeners = new Set<() => void>();

  get = (): AiWriteSession | null => this.session;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private set(change: Partial<AiWriteSession>, id: number) {
    if (!this.session || this.session.id !== id) return;
    this.session = { ...this.session, ...change };
    for (const listener of this.listeners) listener();
  }

  /** Opens a card for `command` and starts writing; returns its id. */
  open(command: AiCommand, scope: WriteScope, handler: AiHandler): number {
    this.stop();
    this.count += 1;
    const container = document.createElement('div');
    container.setAttribute('data-ai-write', '');
    container.contentEditable = 'false';
    this.session = {
      id: this.count,
      command,
      scope,
      status: 'streaming',
      text: '',
      runId: null,
      error: null,
      container,
    };
    void this.run(handler, this.count);
    return this.count;
  }

  /** Ask again: the same command on the same words, from scratch. */
  again(handler: AiHandler): void {
    const session = this.session;
    if (!session) return;
    this.stop();
    this.set({ status: 'streaming', text: '', runId: null, error: null }, session.id);
    void this.run(handler, session.id);
  }

  close(): void {
    this.stop();
    if (!this.session) return;
    this.session = null;
    for (const listener of this.listeners) listener();
  }

  private stop() {
    this.controller?.abort();
    this.controller = null;
  }

  private async run(handler: AiHandler, id: number) {
    const session = this.session;
    if (!session || !handler.write) {
      this.set({ status: 'error', error: FAILED }, id);
      return;
    }
    const controller = new AbortController();
    this.controller = controller;
    let text = '';
    try {
      for await (const event of handler.write(session.scope.request, controller.signal)) {
        if (controller.signal.aborted) return;
        if (event.type === 'text') {
          text += event.text;
          this.set({ text }, id);
        } else {
          this.set({ runId: event.runId }, id);
        }
      }
      if (controller.signal.aborted) return;
      this.set(
        text.trim()
          ? { status: 'done' }
          : { status: 'error', error: 'Nothing came back for this one. Try again.' },
        id,
      );
    } catch (error) {
      if (controller.signal.aborted) return;
      this.set({ status: 'error', error: handler.describeError?.(error) ?? FAILED }, id);
    } finally {
      if (this.controller === controller) this.controller = null;
    }
  }
}
