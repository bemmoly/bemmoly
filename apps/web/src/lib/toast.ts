import type { ToastOptions } from '@bemmoly/ui';

type Show = (toast: ToastOptions) => string;

let show: Show | null = null;

/** ToastBridge registers the provider's `show`, so hooks can confirm a save without React context. */
export function registerToast(next: Show | null): void {
  show = next;
}

export function toast(title: string, tone: 'ok' | 'danger' | 'info' = 'ok'): void {
  show?.({ title, tone });
}
