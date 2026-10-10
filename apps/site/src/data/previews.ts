/**
 * The homepage's product pictures: live slices of the demo (dist/demo), each shown first as a
 * poster captured from the same route in the product's light and dark themes
 * (scripts/capture-previews.ts), so the swap to the live frame changes nothing on screen. The
 * demo renders at one desktop size and the frame scales it to fit, so the poster and the live
 * view line up at every width. The four views are the four things people do: plan on the
 * board, write a page, open an issue, groom the backlog.
 */

/** The demo's viewport inside a frame: the Landing mock's 1480 × 860 frame at 1280 wide. */
export const PREVIEW_VIEWPORT = { width: 1280, height: 744 } as const;

export type PreviewId = 'board' | 'docs' | 'issue' | 'backlog';

export interface Preview {
  id: PreviewId;
  /** The tab. */
  label: string;
  /** The tab's drawn icon, from the product's sidebar. */
  icon: 'board' | 'doc' | 'list' | 'backlog';
  /** The demo route the frame opens; also the link without JavaScript, or on a phone. */
  path: string;
  alt: string;
}

/** "RFC: Move sessions to Postgres" in the demo's Engineering space (its seed id 5101). */
const RFC_PAGE = '/demo/docs/p/018f0000-0000-7000-8000-0000000013ed';

export const PREVIEWS: readonly Preview[] = [
  {
    id: 'board',
    label: 'Board',
    icon: 'board',
    path: '/demo/work/board/PLT',
    alt: 'The Platform team’s sprint board in the live demo: one sidebar for Work and Docs, columns by status with counts and a WIP limit, and epics as swimlanes.',
  },
  {
    id: 'docs',
    label: 'Docs page',
    icon: 'doc',
    path: RFC_PAGE,
    alt: 'An RFC page in Docs in the live demo, in its space’s page tree, with the issues it links to and their live status.',
  },
  {
    id: 'issue',
    label: 'Issue',
    icon: 'list',
    path: '/demo/work/issue/PLT-204',
    alt: 'An issue in the live demo: its status, description and activity, with its fields beside it.',
  },
  {
    id: 'backlog',
    label: 'Backlog',
    icon: 'backlog',
    path: '/demo/work/backlog/PLT',
    alt: 'The backlog in the live demo: the running sprint with its issues and points, and what comes next.',
  },
];

/** The phone poster: the product's own phone layout, not a desktop board shrunk to a stamp. */
export const PHONE_POSTER = {
  id: 'board-phone',
  path: '/demo/work/board/PLT',
  viewport: { width: 390, height: 844 },
  alt: 'The sprint board on a phone in the live demo, with the sprint’s progress and its columns.',
} as const;
