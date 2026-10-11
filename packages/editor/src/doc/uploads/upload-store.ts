/*
 * Images on their way into the page. While one uploads, the page holds nothing for it: the
 * editor draws a local placeholder where it will land (a widget decoration, never a node, so
 * collaborators and the stored document never see a half-made image or its bytes), and this
 * store holds what that placeholder shows. Each entry owns the element its widget renders, so
 * React can portal into it without the decoration being rebuilt as progress moves.
 */

export interface PendingUpload {
  id: string;
  file: File;
  /** 0..1, or null while the size of what has gone is unknown. */
  progress: number | null;
  /** What went wrong, in words a person can act on; absent while it is going. */
  error?: string;
  element: HTMLElement;
}

export class UploadStore {
  private readonly entries = new Map<string, PendingUpload>();
  private snapshot: PendingUpload[] = [];
  private readonly listeners = new Set<() => void>();
  private next = 0;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  };

  get = () => this.snapshot;

  find(id: string): PendingUpload | undefined {
    return this.entries.get(id);
  }

  add(file: File): PendingUpload {
    const element = document.createElement('div');
    element.contentEditable = 'false';
    element.dataset['uploadPlaceholder'] = '';
    const entry: PendingUpload = { id: `upload-${++this.next}`, file, progress: 0, element };
    this.entries.set(entry.id, entry);
    this.emit();
    return entry;
  }

  update(id: string, change: Partial<Pick<PendingUpload, 'progress' | 'error'>>): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    const next: PendingUpload = { ...entry, ...change };
    if ('error' in change && change.error === undefined) delete next.error;
    this.entries.set(id, next);
    this.emit();
  }

  remove(id: string): void {
    if (this.entries.delete(id)) this.emit();
  }

  private emit() {
    this.snapshot = [...this.entries.values()];
    for (const listener of this.listeners) listener();
  }
}
