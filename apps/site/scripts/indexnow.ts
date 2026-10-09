/**
 * Submits every URL in the live sitemap to IndexNow, so the engines that support it (Bing,
 * Yandex, Naver, Seznam, Yep, DuckDuckGo) recrawl within hours of a deploy. Google does not
 * use IndexNow; it reads the sitemap registered in Search Console (README.md, Search engines).
 *
 * With a local build in dist/, it first waits until the live site serves the same sitemap
 * (every page and its lastmod), so a ping sent while Coolify is still deploying does not ask
 * engines to recrawl the previous version. Run: `pnpm --filter @bemmoly/site indexnow`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { INDEXNOW_ENDPOINT, INDEXNOW_KEY } from '../src/lib/indexnow.ts';
import { SITE_URL } from '../src/lib/links.ts';
import { getText, postJson } from './clients/http.ts';

const WAIT_MS = 30_000;
const ATTEMPTS = 40;

const host = new URL(SITE_URL).host;
const local = new URL('../dist/sitemap-0.xml', import.meta.url);

const locs = (xml: string) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1] ?? '');
/** "url lastmod" pairs, so a changed date counts as a different sitemap. */
const entries = (xml: string) =>
  [...xml.matchAll(/<url><loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?/g)].map(
    (m) => `${m[1]} ${m[2] ?? ''}`,
  );

async function liveSitemap(): Promise<string[]> {
  const index = await getText(`${SITE_URL}/sitemap-index.xml`);
  return (await Promise.all(locs(index).map(getText))).flatMap(entries);
}

async function waitForDeploy(expected: readonly string[]): Promise<string[]> {
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    const live = await liveSitemap().catch(() => [] as string[]);
    const missing = expected.filter((entry) => !live.includes(entry));
    if (missing.length === 0) return live;
    process.stdout.write(
      `Waiting for the deploy (${missing.length} pages differ, try ${attempt}).\n`,
    );
    await new Promise((resolve) => setTimeout(resolve, WAIT_MS));
  }
  throw new Error('the live sitemap never matched this build; is the deploy stuck?');
}

const live = existsSync(local)
  ? await waitForDeploy(entries(readFileSync(local, 'utf8')))
  : await liveSitemap();
const urlList = live.map((entry) => entry.split(' ')[0] ?? '');
if (urlList.length === 0) throw new Error('the sitemap lists no pages');

const served = (await getText(`${SITE_URL}/${INDEXNOW_KEY}.txt`)).trim();
if (served !== INDEXNOW_KEY) throw new Error('the live site serves a different IndexNow key');

const { status, text } = await postJson(INDEXNOW_ENDPOINT, {
  host,
  key: INDEXNOW_KEY,
  keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
  urlList,
});
// 200 and 202 both mean accepted; anything else is a problem with the key or the payload.
if (status !== 200 && status !== 202) throw new Error(`IndexNow answered ${status}: ${text}`);
process.stdout.write(`Submitted ${urlList.length} URLs for ${host} (${status}).\n`);
