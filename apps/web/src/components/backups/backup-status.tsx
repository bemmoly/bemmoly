import { Card } from '@bemmoly/ui';
import { Fragment } from 'react';
import type { StatusPart } from '../../hooks/use-backups.ts';
import { Notice } from '../form.tsx';
import { StatusCircle } from '../system/status-circle.tsx';

interface BackupStatusProps {
  parts: readonly StatusPart[];
  oneDisk: boolean;
}

/** The line at the top of Storage and backups, and the two things an admin must know. */
export function BackupStatus({ parts, oneDisk }: BackupStatusProps) {
  const healthy = parts.length > 0 && !parts.some((part) => part.caution);
  return (
    <div className="flex flex-col gap-3">
      <Card className="flex items-center gap-2.5 px-4 py-3 text-13">
        <StatusCircle tone={healthy ? 'ok' : 'caution'} />
        <p className="m-0 text-tx2">
          {parts.map((part, index) => (
            <Fragment key={part.text}>
              {index > 0 ? <span className="text-tx5"> · </span> : null}
              <span className={part.caution ? 'font-medium text-amber-fg' : undefined}>
                {part.text}
              </span>
            </Fragment>
          ))}
        </p>
      </Card>
      {oneDisk ? (
        <Notice tone="caution">
          One disk: backups sit on the same disk as the data, so losing that disk loses both. Add an
          S3-compatible bucket below as a second destination.
        </Notice>
      ) : null}
      <Notice>
        Backups do not include <span className="font-mono text-12">/var/bemmoly/.env</span>. It
        holds the secret key that decrypts stored provider keys, SMTP passwords and SSO secrets.
        Keep a copy somewhere safe: without it, a restore works but those integrations must be
        entered again.
      </Notice>
    </div>
  );
}
