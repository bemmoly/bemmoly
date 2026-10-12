import { Button, EmptyState } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import type { ContainerChooser } from '../../hooks/use-container-chooser.ts';
import { Notice } from '../form.tsx';
import { count, plural } from './import-words.ts';

/** More than this many and counts load as rows come into view. */
export const BIG_SITE = 200;

/** What the account needs to read what is inside. */
const permissionFor = (container: string) =>
  container === 'space' ? 'view permission on the space' : 'Browse projects permission';

interface TokenSeesNothingProps {
  chooser: ContainerChooser;
  label: string;
  onChangeConnection: () => void;
}

/** The token lists nothing: why, and the two ways forward. */
export function TokenSeesNothing({ chooser, label, onChangeConnection }: TokenSeesNothingProps) {
  const { nouns, email } = chooser;
  return (
    <EmptyState
      icon={<Icon name="lock" size={18} />}
      title={`This token can't see any ${nouns.containers}`}
      description={`${email ? `Connected as ${email}, but` : 'Connected, but'} ${label} lists no ${nouns.containers} for this account. Give the account ${permissionFor(nouns.container)}, or connect with an admin's token.`}
      headingLevel={3}
      action={
        <span className="flex flex-wrap justify-center gap-2">
          <Button icon={<Icon name="back" />} onClick={onChangeConnection}>
            Change connection
          </Button>
          <Button
            variant="primary"
            icon={<Icon name="refresh" />}
            loading={chooser.loading}
            onClick={chooser.refetch}
          >
            Check again
          </Button>
        </span>
      }
    />
  );
}

/** A search or filter that shows nothing says so, with the way back. */
export function NothingShown({ chooser }: { chooser: ContainerChooser }) {
  const { nouns, q } = chooser;
  if (q) {
    return (
      <EmptyState
        size="sm"
        icon={<Icon name="search" size={16} />}
        title={`No ${nouns.containers} match “${q}”`}
        description="Search looks at the key, the name and the lead."
        action={<Button onClick={chooser.clearSearch}>Clear search</Button>}
      />
    );
  }
  return (
    <EmptyState
      size="sm"
      icon={<Icon name="list" size={16} />}
      title={`No ${nouns.containers} here`}
      description={`Nothing on this site fits this filter. Show all ${nouns.containers} to choose.`}
      action={<Button onClick={() => chooser.setFilter('all')}>Show all</Button>}
    />
  );
}

interface ChooserNoticesProps {
  chooser: ContainerChooser;
  label: string;
  onChangeConnection: () => void;
}

/** The site-wide notes: rows the token cannot read, and a big site's lazy counts. */
export function ChooserNotices({ chooser, label, onChangeConnection }: ChooserNoticesProps) {
  const { nouns, total, email } = chooser;
  const locked = chooser.siteCounts?.noaccess ?? 0;
  const lockedNames = chooser.rows.filter((row) => row.access === 'none').map((row) => row.name);
  const who = lockedNames.length === locked && locked <= 2 ? lockedNames.join(' and ') : null;
  return (
    <>
      {total > BIG_SITE ? (
        <Notice>
          <b className="font-semibold">{plural(total, nouns)}.</b>{' '}
          {nouns.records.charAt(0).toUpperCase() + nouns.records.slice(1)} counts load as rows come
          into view, so totals marked ~ are still counting. Search and filters run on the whole
          list.
        </Notice>
      ) : null}
      {locked > 0 ? (
        <Notice tone="caution">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="min-w-60 flex-1">
              <b className="font-semibold">
                {who ?? plural(locked, nouns)} can&apos;t be read with this token.
              </b>{' '}
              {locked === 1 ? 'It is' : 'They are'} listed, but {locked === 1 ? 'its' : 'their'}{' '}
              {nouns.records} are hidden
              {email ? ` from ${email}` : ''}. Ask a {label} admin for{' '}
              {permissionFor(nouns.container)}, or connect with another token.
            </span>
            <Button size="sm" onClick={onChangeConnection}>
              Change connection
            </Button>
          </span>
        </Notice>
      ) : null}
    </>
  );
}

/** "12 projects · ~23,410 issues (3 still counting)", announced as it changes. */
export function RunningTotal({ chooser }: { chooser: ContainerChooser }) {
  const { summary, nouns } = chooser;
  const selected = summary?.selected ?? 0;
  const pending = summary?.uncounted ?? 0;
  return (
    <span aria-live="polite" className="text-13 text-tx-2 tabular-nums">
      <b className="font-semibold text-tx">{count(selected)}</b>{' '}
      {selected === 1 ? nouns.container : nouns.containers} · {pending ? '~' : ''}
      <b className="font-semibold text-tx">{count(summary?.records ?? 0)}</b> {nouns.records}
      {pending ? <span className="text-tx-3"> ({count(pending)} still counting)</span> : null}
    </span>
  );
}
