import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app.tsx';
import './styles.css';

async function boot(): Promise<void> {
  // The dev server sets this so the mock backend is compiled out of builds.
  if (__MOCK_API__) {
    const { startDevMocks } = await import('./mocks/browser.ts');
    await startDevMocks();
  }
  const container = document.getElementById('root');
  if (!container) throw new Error('Missing #root element');
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void boot();
