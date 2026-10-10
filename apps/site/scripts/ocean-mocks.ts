/**
 * Turns the Landing mock's embedded screens into their Ocean versions for the dark-mode
 * product shots. The Board mock has a theme prop, so its imports get theme="ocean". The
 * Command palette is drawn with Classic literals only, so each literal is swapped for the
 * same token's Ocean value, picking the token by the CSS property it is used in.
 */
import { COLOR_TOKENS, themeById, type ColorToken } from '@bemmoly/ui/tokens';
import { darkColors } from '../src/lib/theme.ts';

const classic = themeById('light').colors;
/** The site's dark palette (Ocean, with contrastCheck's text on accent), so shots match. */
const ocean = darkColors();

/** Token preference per property, for literals several tokens share (#fff, #2456c9). */
const PREFER: Record<'background' | 'color' | 'border', readonly ColorToken[]> = {
  background: ['card', 'sunken', 'side', 'line-2', 'acc-50', 'green-50', 'acc-fill'],
  color: ['tx', 'tx-2', 'tx-3', 'acc', 'acc-600', 'acc-500', 'on-acc'],
  border: ['line', 'line-2', 'acc-100', 'acc'],
};

function tokenFor(hex: string, property: keyof typeof PREFER): ColorToken | undefined {
  const value = hex.toLowerCase();
  const named = COLOR_TOKENS.filter((token) => classic[token].toLowerCase() === value);
  return PREFER[property].find((token) => named.includes(token)) ?? named[0];
}

function propertyOf(name: string): keyof typeof PREFER {
  if (name.startsWith('background')) return 'background';
  if (name.startsWith('border') || name.startsWith('outline') || name === 'box-shadow') {
    return 'border';
  }
  return 'color';
}

/** Rewrites `prop: … #hex …` declarations to Ocean values; unknown literals stay. */
function remapLiterals(source: string): string {
  return source.replace(
    /([a-z-]+)\s*:\s*([^;"'}]*#[0-9a-fA-F]{3,6}\b[^;"'}]*)/g,
    (all, prop, v) => {
      const property = propertyOf(prop as string);
      const value = (v as string).replace(/#[0-9a-fA-F]{3,6}\b/g, (hex) => {
        const token = tokenFor(hex, hex === '#fff' && property === 'color' ? 'color' : property);
        return token ? ocean[token] : hex;
      });
      return `${prop}:${value}`;
    },
  );
}

/** The DCLogic block passes colours to the markup as `bg`, `br` and `fg` values. */
const SCRIPT_KEYS: Record<string, keyof typeof PREFER> = {
  bg: 'background',
  br: 'border',
  fg: 'color',
};

function remapScript(source: string): string {
  return source.replace(/\b(bg|br|fg)\s*:\s*([^,}]*)/g, (all, key: string, expression: string) => {
    const property = SCRIPT_KEYS[key] ?? 'color';
    const value = expression.replace(/#[0-9a-fA-F]{3,6}\b/g, (hex) => {
      const token = tokenFor(hex, property);
      return token ? ocean[token] : hex;
    });
    return `${key}: ${value}`;
  });
}

const withOceanBoard = (source: string) =>
  source.replace(
    /<dc-import name="Bemmoly Board"/g,
    '<dc-import name="Bemmoly Board" theme="ocean"',
  );

/** The served file for the Ocean pass, by mock file name. */
export function oceanVariant(file: string, source: string): string {
  if (file === 'Bemmoly Landing.dc.html') return withOceanBoard(source);
  if (file === 'Bemmoly Command.dc.html') {
    const [head = '', script = ''] = source.split('<script type="text/x-dc"');
    const logic = script ? `<script type="text/x-dc"${remapScript(script)}` : '';
    return withOceanBoard(remapLiterals(head)) + logic;
  }
  return source;
}
