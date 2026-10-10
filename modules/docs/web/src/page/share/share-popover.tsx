import { Avatar, avatarHue, Button, Skeleton } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api.ts';
import { docsKeys } from '../../shared/keys.ts';
import { DocPopover } from '../body/doc-popover.tsx';
import { useCopyLink } from '../header/more-menu.tsx';
import { usePageScreen } from '../screen-context.ts';

const SHOWN = 8;

/** Who can open the page: the space's active members and the org admins, with their roles. */
function WhoCanSee() {
  const { page } = usePageScreen();
  const members = useQuery({
    queryKey: docsKeys.members(page.spaceKey),
    queryFn: () => api.docs.members.list(page.spaceKey),
    staleTime: 60_000,
  });
  const copyLink = useCopyLink(page.id);
  const people = (members.data?.items ?? []).filter((member) => member.status === 'active');
  return (
    <div className="flex w-80 flex-col gap-3 p-2">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-13 font-semibold text-tx">Who can see this</h2>
        <p className="m-0 text-13 leading-body text-tx-2">
          Everyone in this space can open the page. Pages have no permissions of their own; the
          space decides.
        </p>
      </div>
      {members.isPending ? (
        <div role="status" aria-label="Loading members" className="flex flex-col gap-2">
          <Skeleton width="70%" />
          <Skeleton width="55%" />
        </div>
      ) : members.isError ? (
        <p className="m-0 text-13 text-tx-3">The members did not load. Close this and try again.</p>
      ) : (
        <ul aria-label="Space members" className="m-0 flex list-none flex-col gap-0.5 p-0">
          {people.slice(0, SHOWN).map((member) => (
            <li key={member.userId} className="flex h-8 items-center gap-2 text-13">
              <Avatar name={member.name} hue={avatarHue(member.userId)} size={20} />
              <span className="min-w-0 flex-1 truncate text-tx">{member.name}</span>
              <span className="text-12 text-tx-3">
                {member.access === 'org_admin' ? 'Workspace admin' : member.roleName}
              </span>
            </li>
          ))}
          {people.length > SHOWN && (
            <li className="pt-1 text-12 text-tx-3">and {people.length - SHOWN} more</li>
          )}
        </ul>
      )}
      <div className="flex items-center justify-end gap-2 border-t border-line pt-2.5">
        <Button
          size="sm"
          variant="primary"
          icon={<Icon name="link" size={14} />}
          onClick={() => void copyLink()}
        >
          Copy link
        </Button>
      </div>
    </div>
  );
}

/**
 * Share, honestly: a popover that says who can open the page (the space's members and their
 * roles, from the members endpoint) and copies the link. No per-page sharing is invented.
 */
export function SharePopover() {
  return (
    <DocPopover
      label="Share"
      align="end"
      trigger={(props) => (
        <Button {...props} size="sm" icon={<Icon name="people" size={14} />}>
          Share
        </Button>
      )}
    >
      {() => <WhoCanSee />}
    </DocPopover>
  );
}
