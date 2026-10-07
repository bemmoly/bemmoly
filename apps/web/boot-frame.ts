import { readFileSync } from 'node:fs';
import type { HtmlTagDescriptor, Plugin, Rolldown } from 'vite';

const LOGO_SLOT = '<!-- boot:logo -->';

/**
 * The brand file made fit for index.html: the CSP forbids inline style
 * attributes, so `style="fill: var(--brand-mark-bg, …)"` becomes
 * `class="brand-mark-bg"` and the boot frame's markup colours it with tokens.
 */
export function inlineLogo(svg: string): string {
  return svg
    .replace(/\sstyle="fill:\s*var\(--([\w-]+)[^"]*"/g, ' class="$1"')
    .replace(/\s(role|aria-label)="[^"]*"/g, '')
    .replace(/<svg\b/, '<svg aria-hidden="true" focusable="false"')
    .trim();
}

/** A chunk and every chunk it statically imports, minus the ones already loading. */
export function chunkGraph(
  bundle: Rolldown.OutputBundle,
  root: Rolldown.OutputChunk,
  skip: ReadonlySet<string>,
): string[] {
  const seen = new Set<string>();
  const visit = (chunk: Rolldown.OutputChunk) => {
    if (seen.has(chunk.fileName) || skip.has(chunk.fileName)) return;
    seen.add(chunk.fileName);
    for (const name of chunk.imports) {
      const next = bundle[name];
      if (next?.type === 'chunk') visit(next);
    }
  };
  visit(root);
  return [...seen];
}

/**
 * The shell's first paint. index.html carries a static frame (the top bar and
 * the logo lockup from the brand files) that the main stylesheet alone draws,
 * and the entry imports the app only after that frame is on screen. The app's
 * chunks are still fetched from the start, in parallel, at low priority, so
 * only the stylesheet stands between the document and first paint.
 */
export function bootFrame(options: { logo: string; app: string }): Plugin {
  const { app } = options;
  let base = '/';
  return {
    name: 'bemmoly-boot-frame',
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, context) {
        const page = html.replace(LOGO_SLOT, inlineLogo(readFileSync(options.logo, 'utf8')));
        const { bundle, chunk: entry } = context;
        if (!bundle || !entry) return page;
        const chunk = Object.values(bundle).find(
          (output): output is Rolldown.OutputChunk =>
            output.type === 'chunk' && output.facadeModuleId === app,
        );
        if (!chunk) throw new Error(`boot frame: the build has no chunk for ${app}`);
        const loading = new Set([entry.fileName, ...entry.imports]);
        const tags: HtmlTagDescriptor[] = chunkGraph(bundle, chunk, loading).map((file) => ({
          tag: 'link',
          attrs: {
            rel: 'modulepreload',
            crossorigin: true,
            fetchpriority: 'low',
            href: base + file,
          },
          injectTo: 'head',
        }));
        return { html: page, tags };
      },
    },
  };
}
