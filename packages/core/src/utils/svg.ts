/*
 * SVG served from our origin: AI provider logos from the catalog and the workspace's own logo.
 * Both are drawn with <img>, which never runs script, but either can be opened directly, so
 * anything active or anything that reaches out is refused rather than rewritten.
 */

/** Embedded pictures a logo may carry; nothing else is fetched or run. */
const IMAGE_DATA = String.raw`data:image/(?:png|jpe?g|gif|webp);base64,`;

/**
 * Anything active or anything that reaches out: scripts, event handlers, foreign objects,
 * links and animations that can rewrite them, character references that hide a scheme, and
 * every reference that is not to the logo itself or an embedded picture.
 */
const UNSAFE_SVG = new RegExp(
  [
    String.raw`<script|<foreignObject|<iframe|<!ENTITY|<a[\s>]|<animate|<set[\s>]`,
    String.raw`\son[a-z]+\s*=|javascript:|&#|@import`,
    String.raw`(?:xlink:)?href\s*=\s*["'](?!#|${IMAGE_DATA})`,
    String.raw`url\(\s*["']?(?!#)`,
    String.raw`data:(?!image/(?:png|jpe?g|gif|webp);base64,)`,
  ].join('|'),
  'i',
);

/** A logo is SVG served from our origin, so anything active in it is refused. */
export function safeSvg(svg: string | null | undefined): string | null {
  if (!svg || !svg.trimStart().startsWith('<svg')) return null;
  if (UNSAFE_SVG.test(svg)) return null;
  return svg;
}

/**
 * The same check for an SVG file a person uploads: design tools start the file with an XML
 * declaration, comments and a DOCTYPE, which are dropped first. A DOCTYPE with an internal
 * subset can declare entities, so it is refused. Answers the markup that is stored and served.
 */
export function sanitiseUploadedSvg(text: string): string | null {
  let rest = text.replace(/^\uFEFF/, '').trimStart();
  for (;;) {
    const prolog = /^(<\?xml[^>]*\?>|<!--[\s\S]*?-->|<!DOCTYPE\s+svg[^[>]*>)\s*/i.exec(rest);
    if (!prolog) break;
    rest = rest.slice(prolog[0].length);
  }
  return safeSvg(rest.trimEnd());
}
