import type { APIRoute } from 'astro';
import { CRAWLERS } from '../data/crawlers.ts';
import { INDEXNOW_KEY } from '../lib/indexnow.ts';

export const GET: APIRoute = ({ site }) => {
  const sitemap = new URL('/sitemap-index.xml', site).href;
  const groups = CRAWLERS.map(
    ({ label, agents }) =>
      `# ${label}\n${agents.map((agent) => `User-agent: ${agent}`).join('\n')}\nAllow: /\n`,
  );
  const body = [
    '# Everything on this site is public. Every crawler, search engine and AI assistant is',
    '# welcome to read and index all of it. Machine-readable summary: /llms.txt',
    '',
    'User-agent: *',
    'Allow: /',
    '',
    ...groups,
    `Sitemap: ${sitemap}`,
    `# IndexNow key: /${INDEXNOW_KEY}.txt`,
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
