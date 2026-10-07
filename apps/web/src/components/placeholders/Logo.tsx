/**
 * PLACEHOLDER for @bemmoly/ui Logo. Renders the brand SVG files in
 * packages/ui/assets/brand/ and never draws the logo itself. Files are found
 * by name, `<variant>-<tone>.svg` (tone "color" for light surfaces, "light"
 * for dark ones), so new brand files appear without a code change; a missing
 * variant falls back to mark-color.svg.
 */
const FILES = import.meta.glob<string>('../../../../../packages/ui/assets/brand/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
});

const byName = new Map(
  Object.entries(FILES).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -4), url]),
);

export type LogoVariant = 'mark' | 'wordmark' | 'lockup';
export type LogoTone = 'auto' | 'light' | 'dark' | 'mono';

export interface LogoProps {
  variant?: LogoVariant;
  tone?: LogoTone;
  /** Rendered height in px: 24 in the top bar, 26 in the setup header. */
  size?: number;
  label?: string;
}

function fileFor(variant: LogoVariant, tone: string): string | undefined {
  return (
    byName.get(`${variant}-${tone}`) ?? byName.get(`${variant}-color`) ?? byName.get('mark-color')
  );
}

export function Logo({ variant = 'mark', tone = 'auto', size = 24, label = 'Bemmoly' }: LogoProps) {
  const style = { height: size };
  const img = (src: string | undefined, className = '') =>
    src ? (
      <img src={src} alt={label} style={style} className={`block w-auto shrink-0 ${className}`} />
    ) : null;
  if (tone !== 'auto') return img(fileFor(variant, tone === 'dark' ? 'dark' : tone));
  const onLight = fileFor(variant, 'color');
  const onDark = fileFor(variant, 'light');
  if (onLight === onDark) return img(onLight);
  return (
    <>
      {img(onLight, 'dark:hidden')}
      {img(onDark, 'hidden dark:block')}
    </>
  );
}
