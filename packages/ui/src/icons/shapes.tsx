import type { ReactNode } from 'react';

/**
 * The icons the mocks draw with CSS boxes (borders, gradients, inset shadows), redrawn as SVG
 * at the same natural size and the same 1.5px stroke. Geometry follows the CSS: a border is a
 * stroke centred 0.75px inside the box, border-radius minus 0.75 is the path radius. Strokes
 * stay 1.5px at any drawn size, as CSS borders do (Releases scales its border, as in the mock).
 * The last few have no mock; they are drawn in the same style for the Setup option tiles.
 */
export interface ShapeDef {
  /** Natural width and height in px, from the mock. */
  w: number;
  h: number;
  body: ReactNode;
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  vectorEffect: 'non-scaling-stroke',
} as const;
const third = 10 / 3;

export const SHAPES = {
  /** Sidebar "Roadmap": 14x10 box, 2px radius, left 40% filled. */
  roadmap: {
    w: 14,
    h: 10,
    body: (
      <>
        <path d="M2 0H5.6V10H2A2 2 0 0 1 0 8V2A2 2 0 0 1 2 0Z" fill="currentColor" />
        <rect x={0.75} y={0.75} width={12.5} height={8.5} rx={1.25} {...stroke} />
      </>
    ),
  },
  /** Sidebar "Backlog": top border plus its inset shadow (3px) and a bottom border. */
  backlog: {
    w: 14,
    h: 12,
    body: (
      <>
        <rect width={14} height={3} fill="currentColor" />
        <rect y={10.5} width={14} height={1.5} fill="currentColor" />
      </>
    ),
  },
  /** Sidebar "Board": three columns, 100%, 70% and 45% tall, top aligned. */
  board: {
    w: 14,
    h: 12,
    body: (
      <>
        <rect width={third} height={12} fill="currentColor" />
        <rect x={third + 2} width={third} height={8.4} fill="currentColor" />
        <rect x={2 * third + 4} width={third} height={5.4} fill="currentColor" />
      </>
    ),
  },
  /** Sidebar "Sprints": a ring with its right border transparent. */
  sprint: {
    w: 12,
    h: 12,
    body: <path d="M9.712 2.288A5.25 5.25 0 1 0 9.712 9.712" {...stroke} />,
  },
  /** Sidebar "Reports": three bars, 50%, 100% and 70% tall, bottom aligned. */
  reports: {
    w: 14,
    h: 12,
    body: (
      <>
        <rect y={6} width={third} height={6} fill="currentColor" />
        <rect x={third + 2} width={third} height={12} fill="currentColor" />
        <rect x={2 * third + 4} y={3.6} width={third} height={8.4} fill="currentColor" />
      </>
    ),
  },
  /** Doc page: 11x13, 2px radius (drawn at 8x10, 9x11 and 10x12 elsewhere). */
  doc: {
    w: 11,
    h: 13,
    body: <rect x={0.75} y={0.75} width={9.5} height={11.5} rx={1.25} {...stroke} />,
  },
  /** "Linked pages" and "Members": an outlined circle. */
  circle: {
    w: 13,
    h: 13,
    body: <circle cx={6.5} cy={6.5} r={5.75} {...stroke} />,
  },
  /** "Releases": a 12px square, 3px radius, rotated 45deg and scaled .85 (stroke included). */
  releases: {
    w: 12,
    h: 12,
    body: (
      <rect
        x={0.75}
        y={0.75}
        width={10.5}
        height={10.5}
        rx={2.25}
        transform="translate(6 6) rotate(45) scale(.85) translate(-6 -6)"
        {...stroke}
        vectorEffect="none"
      />
    ),
  },
  /** Top bar settings: a ring with an inner ring (inset shadows 3px and 4.5px). */
  settings: {
    w: 14,
    h: 14,
    body: (
      <>
        <circle cx={7} cy={7} r={6.25} {...stroke} />
        <circle cx={7} cy={7} r={1.75} {...stroke} />
      </>
    ),
  },
  /** Top bar inbox: 14x14, radius 4 at the top and 7 at the bottom. */
  inbox: {
    w: 14,
    h: 14,
    body: (
      <path
        d="M0.75 4A3.25 3.25 0 0 1 4 0.75H10A3.25 3.25 0 0 1 13.25 4V7A6.25 6.25 0 0 1 0.75 7Z"
        {...stroke}
      />
    ),
  },
  /** Setup option tiles, no mock: a key for "any identity provider" single sign-on. */
  key: {
    w: 14,
    h: 14,
    body: (
      <>
        <circle cx={4.5} cy={9.5} r={3.75} {...stroke} />
        <path d="M7.2 6.8L13.25 0.75M10.25 3.75L12.25 5.75M12 2L13.5 3.5" {...stroke} />
      </>
    ),
  },
  /** Setup option tiles, no mock: two stacked units for a model server on the local network. */
  server: {
    w: 14,
    h: 14,
    body: (
      <>
        <rect x={0.75} y={0.75} width={12.5} height={5} rx={1.25} {...stroke} />
        <rect x={0.75} y={8.25} width={12.5} height={5} rx={1.25} {...stroke} />
        <circle cx={3.5} cy={3.25} r={0.9} fill="currentColor" />
        <circle cx={3.5} cy={10.75} r={0.9} fill="currentColor" />
      </>
    ),
  },
  /** Setup option tiles, no mock: a grid for spreadsheet (CSV) exports. */
  table: {
    w: 14,
    h: 14,
    body: (
      <>
        <rect x={0.75} y={0.75} width={12.5} height={12.5} rx={1.25} {...stroke} />
        <path d="M0.75 5H13.25M0.75 9H13.25M5 5V13.25" {...stroke} />
      </>
    ),
  },
} satisfies Record<string, ShapeDef>;

export type ShapeName = keyof typeof SHAPES;
