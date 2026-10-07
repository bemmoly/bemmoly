import { formatRelative } from '@bemmoly/core-web';
import type { AvailableUpdate, UpdatesOverview } from '@bemmoly/shared';
import { Button, Card, CardBody, CardHeader } from '@bemmoly/ui';
import { releaseWarnings, updateModeCopy } from '../../hooks/use-updates-copy.ts';
import { LINK_ACTION } from '../actions.ts';
import { Notice } from '../form.tsx';

/** A command the admin runs by hand, in the mono face of the Setup mock's URL field. */
export function CommandBlock({ command }: { command: string }) {
  return (
    <pre className="m-0 overflow-x-auto rounded-control border border-br3 bg-sf2 px-3 py-2.5 font-mono text-12h text-tx3">
      {command}
    </pre>
  );
}

export function NotesLink({ release }: { release: AvailableUpdate }) {
  return (
    <a
      className={`text-13 ${LINK_ACTION}`}
      href={release.notesUrl}
      target="_blank"
      rel="noreferrer"
    >
      Release notes for {release.version}
    </a>
  );
}

/** Slow and irreversible changesets and config changes, each as a caution note with its list. */
export function ReleaseWarnings({ release }: { release: AvailableUpdate }) {
  return releaseWarnings(release).map((warning) => (
    <Notice key={warning.title} tone="caution">
      {warning.title}
      <span className="mt-1 block font-mono text-12 whitespace-pre-line">
        {warning.items.join('\n')}
      </span>
    </Notice>
  ));
}

interface ReleaseCardProps {
  overview: UpdatesOverview;
  release: AvailableUpdate;
  busy: boolean;
  onUpdate: () => void;
}

export function ReleaseCard({ overview, release, busy, onUpdate }: ReleaseCardProps) {
  const updater = overview.updater;
  return (
    <Card>
      <CardHeader
        title={`Bemmoly ${release.version}`}
        hint={`released ${formatRelative(release.publishedAt)} on ${overview.current.channel}`}
        actions={<NotesLink release={release} />}
      />
      <CardBody className="flex flex-col gap-3">
        {release.rollback === 'restore' ? (
          <p className="m-0 text-13 leading-body text-tx-body">
            Rolling back from this release would need a restore of the pre-update backup.
          </p>
        ) : (
          <p className="m-0 text-13 leading-body text-tx-body">
            Rolling back from this release keeps your data: it swaps back to the current image.
          </p>
        )}
        <ReleaseWarnings release={release} />
        <div className="flex flex-col gap-2.5 border-t border-br-row pt-4">
          <p className="m-0 text-12h leading-body text-tx4">{updateModeCopy(updater.mode)}</p>
          {updater.mode === 'in_app' ? (
            <div>
              <Button
                variant="primary"
                disabled={busy || updater.state === 'unreachable'}
                onClick={onUpdate}
              >
                Update to {release.version}
              </Button>
            </div>
          ) : (
            <CommandBlock command={updater.command} />
          )}
        </div>
      </CardBody>
    </Card>
  );
}
