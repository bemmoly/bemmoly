/**
 * The site's icons: the product's own set (@bemmoly/ui/icons, Lucide under the design
 * system's names, ADR 0015) plus the few a marketing page needs that the app never draws,
 * from the same Lucide release. They are rendered to SVG at build time (Icon.astro), so no
 * React reaches the browser. Icons are drawn, never typed: the glyph lint rule covers .astro.
 */
import { GLYPHS, ICON_NAMES, KIT_ICONS, SHAPES, type IconName } from '@bemmoly/ui/icons';
import {
  BookOpen,
  CircleAlert,
  CircleCheck,
  CloudOff,
  EyeOff,
  GitBranch,
  Import,
  Infinity as InfinityIcon,
  Monitor,
  Play,
  Scale,
  Share2,
  Star,
  Terminal,
  Upload,
  UserX,
  WifiOff,
  Workflow,
  createLucideIcon,
  type LucideIcon,
} from 'lucide-react';

/** A shopping bag struck through: "no in-app purchases", drawn as Lucide draws its -off icons. */
const BagOff = createLucideIcon('bag-off', [
  ['path', { d: 'M6.3 6H20l-1.6 12.2A2 2 0 0 1 16.4 20H7.6a2 2 0 0 1-2-1.8L4.2 6', key: 'b' }],
  ['path', { d: 'M9 9V6a3 3 0 0 1 5.6-1.5', key: 'h' }],
  ['path', { d: 'm3 3 18 18', key: 's' }],
]);

const SITE_ONLY = {
  /** The repository: GitHub, the licence's home and the proof links. */
  git: GitBranch,
  infinity: InfinityIcon,
  'bag-off': BagOff,
  'eye-off': EyeOff,
  'wifi-off': WifiOff,
  'user-x': UserX,
  'cloud-off': CloudOff,
  terminal: Terminal,
  play: Play,
  'check-circle': CircleCheck,
  import: Import,
  export: Upload,
  star: Star,
  flow: Workflow,
  system: Monitor,
  share: Share2,
  report: CircleAlert,
  licence: Scale,
  guide: BookOpen,
} satisfies Record<string, LucideIcon>;

/** The product's icons under its own names, as its Icon component resolves them. */
const PRODUCT: Record<IconName, LucideIcon> = { ...SHAPES, ...GLYPHS, ...KIT_ICONS };

export type SiteIconName = IconName | keyof typeof SITE_ONLY;

export const SITE_ICON_NAMES: readonly SiteIconName[] = [
  ...ICON_NAMES,
  ...(Object.keys(SITE_ONLY) as (keyof typeof SITE_ONLY)[]),
];

const isSiteOnly = (name: SiteIconName): name is keyof typeof SITE_ONLY => name in SITE_ONLY;

export function siteIcon(name: SiteIconName): LucideIcon {
  return isSiteOnly(name) ? SITE_ONLY[name] : PRODUCT[name];
}

/** The product's stroke at every size (ADR 0015). */
export const ICON_STROKE = 1.75;

/** The product's modules, each drawn as a tile in its logo colour (ModuleTile.astro). */
export type ModuleId = 'work' | 'docs' | 'ai';
