import { applyDocumentLocale, pickLocale, readDeviceLocale, setLocale } from '@bemmoly/core-web';
import { loadLaterIcons } from '@bemmoly/ui/icons';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app.tsx';
import './i18n/catalog.ts';

/**
 * Renders the app into #root. The rail's icons are among the set that loads after Bemmoly's
 * first paint, so they are fetched with the locale rather than left blank for a beat.
 */
export async function mount(): Promise<void> {
  const locale = pickLocale({
    person: null,
    device: readDeviceLocale(),
    browser: navigator.languages,
  });
  applyDocumentLocale(locale);
  await Promise.all([setLocale(locale), loadLaterIcons().catch(() => undefined)]);
  const container = document.getElementById('root');
  if (!container) throw new Error('Missing #root element');
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
