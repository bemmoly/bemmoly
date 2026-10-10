import { enableMockNetwork } from '../mocks/browser.ts';
import { createMockApi } from '../mocks/dispatch.ts';
import { showBanner } from './banner.ts';
import { keepUnderBase } from './base-path.ts';
import { demoWorkspace } from './workspace.ts';
import './demo.css';

/**
 * The public demo (`vite build --mode demo`): the shell on the in-browser mock backend, with
 * no server behind it. Every API and realtime call is answered inside the page and nothing
 * falls through to the network. The data lives in memory only, so a reload starts over.
 */
export async function startDemo(): Promise<void> {
  const root = document.getElementById('root');
  if (!root) throw new Error('Missing #root element');
  keepUnderBase(import.meta.env.BASE_URL, root);
  // Framed by the site's homepage previews, the page around it already says it is a demo.
  if (window.self === window.top) showBanner();
  const workspace = demoWorkspace({ search: window.location.search, version: __APP_VERSION__ });
  const api = createMockApi(workspace);
  await enableMockNetwork(api, { fallback: false });
}
