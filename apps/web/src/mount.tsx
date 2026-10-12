import { StrictMode } from 'react';
import { loadLaterIcons } from '@bemmoly/ui/icons';
import { createRoot } from 'react-dom/client';
import { App } from './app.tsx';
import { startLocale } from './lib/locale.ts';

/** Renders the app into #root; the boot frame stays on top until the router renders a page. */
export async function mount(): Promise<void> {
  // The dev server and the demo build set these, so the mock backend is compiled out of builds.
  if (__DEMO__) {
    const { startDemo } = await import('./demo/start.ts');
    await startDemo();
  } else if (__MOCK_API__) {
    const { startDevMocks } = await import('./mocks/browser.ts');
    await startDevMocks();
  }
  await startLocale();
  const container = document.getElementById('root');
  if (!container) throw new Error('Missing #root element');
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  // The icons the shell does not draw at first come in once the page is idle, off the first load.
  const later = () => void loadLaterIcons().catch(() => undefined);
  if ('requestIdleCallback' in window) window.requestIdleCallback(later);
  else setTimeout(later, 1);
}
