import type { APIRoute } from 'astro';
import { pageAt } from '../data/pages.ts';
import { groupByKind, paragraphHtml, RELEASES, releaseId } from '../lib/changelog.ts';

/** RSS 2.0 for /changelog: one item per release, the notes as HTML. */
const escapeXml = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const rfc822 = (iso: string) => new Date(`${iso}T00:00:00Z`).toUTCString();

export const GET: APIRoute = ({ site }) => {
  const page = pageAt('/changelog');
  const pageUrl = new URL(page.path, site).href;
  const feedUrl = new URL('/changelog.xml', site).href;
  const items = RELEASES.map((release) => {
    const link = `${pageUrl}#${releaseId(release.version)}`;
    const html = groupByKind(release.changes)
      .map(({ title, changes }) => {
        const notes = changes.map((change) => change.paragraphs.map(paragraphHtml).join(''));
        return `<h3>${title}</h3><ul>${notes.map((note) => `<li>${note}</li>`).join('')}</ul>`;
      })
      .join('');
    return [
      '    <item>',
      `      <title>Bemmoly ${escapeXml(release.version)}</title>`,
      `      <link>${link}</link>`,
      `      <guid isPermaLink="true">${link}</guid>`,
      ...(release.date ? [`      <pubDate>${rfc822(release.date)}</pubDate>`] : []),
      `      <description>${escapeXml(html || '<p>A maintenance release with no notes of its own.</p>')}</description>`,
      '    </item>',
    ].join('\n');
  });
  const newest = RELEASES.find((release) => release.date)?.date;
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    '    <title>Bemmoly releases</title>',
    `    <link>${pageUrl}</link>`,
    `    <description>${escapeXml(page.description)}</description>`,
    '    <language>en</language>',
    ...(newest ? [`    <lastBuildDate>${rfc822(newest)}</lastBuildDate>`] : []),
    `    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml"/>`,
    ...items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
