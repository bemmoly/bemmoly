/**
 * The homepage's interactive previews: live slices of the demo (dist/demo), each shown first
 * as a poster captured from the same route (scripts/capture-previews.ts), so the swap to the
 * live frame changes nothing on screen. The demo renders at one desktop size and the frame
 * scales it to fit, so the poster and the live view line up at every width.
 */

/** The demo's viewport inside a frame: the Landing mock's 1480 × 860 frame at 1280 wide. */
export const PREVIEW_VIEWPORT = { width: 1280, height: 744 } as const;

export interface Preview {
  id: 'board' | 'issue' | 'workflow';
  /** The tab. */
  label: string;
  /** What to try, on the button over the poster. */
  action: string;
  /** The demo route the frame opens; also the link without JavaScript, or on a phone. */
  path: string;
  alt: string;
}

export const PREVIEWS: readonly Preview[] = [
  {
    id: 'board',
    label: 'Board',
    action: 'Drag a card',
    path: '/demo/work/board/PLT',
    alt: 'The Platform team’s sprint board in the live demo: columns by status with counts and a WIP limit, swimlanes by epic and cards with their labels, points and assignees.',
  },
  {
    id: 'issue',
    label: 'Issue',
    action: 'Open an issue',
    path: '/demo/work/issue/PLT-204',
    alt: 'An issue in the live demo: its status, description, acceptance criteria and subtasks, with assignee, sprint, epic and labels in the details panel.',
  },
  {
    id: 'workflow',
    label: 'Workflow',
    action: 'Edit the workflow',
    // The Platform project's own copy of the software workflow in the demo's sample data.
    path: '/demo/work/workflows/PLT/018f0000-0000-7000-8000-000000000904',
    alt: 'The visual workflow editor in the live demo: statuses on a canvas joined by named transitions, with Validate and Publish.',
  },
];
