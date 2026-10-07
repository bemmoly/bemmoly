import { formatRelative } from '@bemmoly/core-web';
import type { UpdateStatus } from '@bemmoly/shared';
import { Button, Card, CardBody, CardHeader } from '@bemmoly/ui';
import { updateModeCopy } from '../../hooks/use-updates-copy.ts';
import { Notice } from '../form.tsx';

type Release = NonNullable<UpdateStatus['latest']>;

/** A command the admin runs by hand, in the mono face of the Setup mock's URL field. */
export function CommandBlock({ command }: { command: string }) {
  return (
    <pre className="m-0 overflow-x-auto rounded-control border border-br3 bg-sf2 px-3 py-2.5 font-mono text-12h text-tx3">
      {command}
    </pre>
  );
}

interface ReleaseCardProps {
  status: UpdateStatus;
  release: Release;
  busy: boolean;
  onUpdate: () => void;
}

export function ReleaseCard({ status, release, busy, onUpdate }: ReleaseCardProps) {
  return (
    <Card>
      <CardHeader
        title={`Bemmoly ${release.version}`}
        hint={`released ${formatRelative(release.publishedAt)} on ${status.channel}`}
      />
      <CardBody className="flex flex-col gap-4">
        <p className="m-0 text-13 leading-body whitespace-pre-line text-tx-body">{release.notes}</p>
        {release.irreversible ? (
          <Notice tone="caution">
            This release has a change that cannot be reversed in place. Rolling back from it would
            restore the backup taken just before the update and discard what was written since.
          </Notice>
        ) : null}
        {release.slowChangesets.length ? (
          <Notice tone="caution">
            These changes take longer on large tables, so expect more downtime than usual:{' '}
            <span className="font-mono text-12">{release.slowChangesets.join(', ')}</span>
          </Notice>
        ) : null}
        <div className="flex flex-col gap-2.5 border-t border-br-row pt-4">
          <p className="m-0 text-12h leading-body text-tx4">{updateModeCopy(status.mode)}</p>
          {status.mode === 'in_app' ? (
            <div>
              <Button variant="primary" disabled={busy} onClick={onUpdate}>
                Update to {release.version}
              </Button>
            </div>
          ) : status.command ? (
            <CommandBlock command={status.command} />
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}
