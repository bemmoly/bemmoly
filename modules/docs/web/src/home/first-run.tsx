import { Button, SpaceTile, StartGuide } from '@bemmoly/ui';

const ART = (
  <span className="flex items-end gap-1.5">
    <SpaceTile name="Engineering" tone="accent" size="sm" className="-rotate-6" />
    <SpaceTile name="Product" tone="violet" />
    <SpaceTile name="Operations" tone="slate" size="sm" className="rotate-6" />
  </span>
);

/**
 * The Docs home before anything exists: what Docs is for in a line, then the three steps
 * that fill the home, the first one ready to take. Shown instead of empty sections, which
 * would say nothing about what to do.
 */
export function FirstRun({
  onCreateSpace,
}: {
  /** Absent for someone who may not create spaces. */
  onCreateSpace?: (() => void) | undefined;
}) {
  return (
    <StartGuide
      art={ART}
      title="Write it down once, find it later"
      description="Docs keeps your team's specs, runbooks and decisions in spaces, each with its own tree of pages, linked to the work they describe."
      steps={[
        {
          title: 'Create a space',
          description: onCreateSpace
            ? 'A space is a home for one team or one topic: Engineering, Product, the handbook.'
            : 'Spaces are made by workspace admins. Ask one to create a space and add you.',
          ...(onCreateSpace
            ? { action: <Button onClick={onCreateSpace}>Create space</Button> }
            : {}),
        },
        {
          title: 'Write the first page',
          description: 'Start blank, or from a template: an RFC, a runbook, meeting notes.',
        },
        {
          title: 'Star what you use',
          description: 'Starred pages, your drafts and reviews waiting on you collect here.',
        },
      ]}
    />
  );
}
