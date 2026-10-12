/**
 * The brand files in assets/brand are the source of truth for the logo; this module only loads
 * them. Replacing a file replaces the logo everywhere (see assets/brand/README.md).
 */
export type LogoVariant = 'mark' | 'wordmark' | 'lockup';
export type LogoFileTone = 'color' | 'light' | 'dark' | 'mono';

type Loader = () => Promise<{ default: string }>;

/*
 * Each file is its own small chunk, read when a Logo first asks for it: a screen draws one or
 * two of the twelve, so none of them weighs on the shell's first load.
 */
const LOADERS: Record<LogoVariant, Record<LogoFileTone, Loader>> = {
  mark: {
    color: () => import('../../../assets/brand/mark-color.svg?raw'),
    light: () => import('../../../assets/brand/mark-light.svg?raw'),
    dark: () => import('../../../assets/brand/mark-dark.svg?raw'),
    mono: () => import('../../../assets/brand/mark-mono.svg?raw'),
  },
  wordmark: {
    color: () => import('../../../assets/brand/wordmark-color.svg?raw'),
    light: () => import('../../../assets/brand/wordmark-light.svg?raw'),
    dark: () => import('../../../assets/brand/wordmark-dark.svg?raw'),
    mono: () => import('../../../assets/brand/wordmark-mono.svg?raw'),
  },
  lockup: {
    color: () => import('../../../assets/brand/lockup-color.svg?raw'),
    light: () => import('../../../assets/brand/lockup-light.svg?raw'),
    dark: () => import('../../../assets/brand/lockup-dark.svg?raw'),
    mono: () => import('../../../assets/brand/lockup-mono.svg?raw'),
  },
};

const loaded = new Map<string, string>();
const listeners = new Set<() => void>();

/** Hears of every file that finishes loading. */
export function subscribeBrandFiles(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
const keyOf = (variant: LogoVariant, tone: LogoFileTone) => `${variant}-${tone}`;

/** The file's markup if it has been read already, so a Logo drawn again paints at once. */
export function brandFileNow(variant: LogoVariant, tone: LogoFileTone): string | undefined {
  return loaded.get(keyOf(variant, tone));
}

export async function loadBrandFile(variant: LogoVariant, tone: LogoFileTone): Promise<string> {
  const key = keyOf(variant, tone);
  const known = loaded.get(key);
  if (known !== undefined) return known;
  const svg = (await LOADERS[variant][tone]()).default;
  loaded.set(key, svg);
  for (const listener of listeners) listener();
  return svg;
}

/**
 * The file's markup made decorative, since the Logo wrapper carries the accessible name. The
 * app's CSP refuses inline style attributes, so `style="fill: var(--brand-mark-bg, #2356C9)"`
 * becomes `fill="#2356C9"`: the designed colour, which no theme changes (ADR 0015).
 */
export function decorative(svg: string): string {
  return svg
    .replace(/\sstyle="fill:\s*var\(--[\w-]+,\s*([^)"]+)\)"/g, ' fill="$1"')
    .replace(/<svg\b([^>]*)>/, (_match, attrs: string) => {
      const kept = attrs.replace(/\s(role|aria-label|aria-hidden|focusable)="[^"]*"/g, '');
      return `<svg${kept} aria-hidden="true" focusable="false">`;
    });
}

/**
 * The file cropped to its ink: the viewBox shrinks to the outline's bounds (read from the path
 * coordinates), so the wordmark can sit on a line of text at the size of its letters rather
 * than inside the 24-unit box every file shares.
 */
export function trimmed(svg: string): string {
  const ys = [...svg.matchAll(/\bd="([^"]+)"/g)].flatMap(([, d = '']) =>
    [...d.matchAll(/-?\d+(?:\.\d+)?[ ,](-?\d+(?:\.\d+)?)/g)].map(([, y]) => Number(y)),
  );
  const width = /viewBox="0 0 ([\d.]+) /.exec(svg)?.[1];
  if (!ys.length || !width) return svg;
  const top = Math.min(...ys);
  const height = Number((Math.max(...ys) - top).toFixed(2));
  return svg
    .replace(/viewBox="[^"]*"/, `viewBox="0 ${top} ${width} ${height}"`)
    .replace(/\sheight="[\d.]+"/, ` height="${height}"`);
}
