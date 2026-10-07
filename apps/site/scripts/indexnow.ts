/**
 * Submits every URL in the live sitemap to IndexNow, so the engines that support it (Bing,
 * Yandex, Naver, Seznam, Yep, DuckDuckGo) recrawl within hours of a deploy. Run after the
 * site is live: `pnpm --filter @bemmoly/site indexnow`. Google does not use IndexNow; it
 * reads the sitemap registered in Search Console (see README.md).
 */
import { INDEXNOW_ENDPOINT, INDEXNOW_KEY } from '../src/lib/indexnow.ts';
import { SITE_URL } from '../src/lib/links.ts';

const host = new URL(SITE_URL).host;
const timeout = AbortSignal.timeout(15_000);

async function text(url: string): Promise<string> {
  const response = await fetch(url, { signal: timeout });
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response.text();
}

const locs = (xml: string) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1] as string);

const index = await text(`${SITE_URL}/sitemap-index.xml`);
const urlList = (await Promise.all(locs(index).map(text))).flatMap(locs);
if (urlList.length === 0) throw new Error('the sitemap lists no pages');

const served = (await text(`${SITE_URL}/${INDEXNOW_KEY}.txt`)).trim();
if (served !== INDEXNOW_KEY) throw new Error('the live site serves a different IndexNow key');

const response = await fetch(INDEXNOW_ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({
    host,
    key: INDEXNOW_KEY,
    keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
    urlList,
  }),
  signal: timeout,
});
// 200 and 202 both mean accepted; anything else is a problem with the key or the payload.
if (response.status !== 200 && response.status !== 202) {
  throw new Error(`IndexNow answered ${response.status}: ${await response.text()}`);
}
process.stdout.write(`Submitted ${urlList.length} URLs for ${host} (${response.status}).\n`);
