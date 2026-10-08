import type { User } from '@bemmoly/shared';
import { IconButton, Menu, MenuItem } from '@bemmoly/ui';

export interface UserMenuActions {
  /** The signed-in person, who cannot deactivate themselves. */
  selfId: string;
  deactivate: (user: User) => void;
  reactivate: (user: User) => void;
  resend: (user: User) => void;
  copyLink: (user: User) => void;
  revoke: (user: User) => void;
}

/** The ··· at the end of a user row. */
export function UserMenu({ user, actions }: { user: User; actions: UserMenuActions }) {
  return (
    <Menu
      align="end"
      widthClassName="w-52"
      trigger={(props) => (
        <IconButton
          {...props}
          label={`Actions for ${user.name}`}
          icon="more"
          size="xs"
          className="font-normal text-tx6"
        />
      )}
    >
      {user.status === 'invited' ? (
        <>
          <MenuItem onSelect={() => actions.resend(user)}>Resend invitation</MenuItem>
          <MenuItem onSelect={() => actions.copyLink(user)}>Copy invite link</MenuItem>
          <MenuItem tone="danger" onSelect={() => actions.revoke(user)}>
            Revoke invitation
          </MenuItem>
        </>
      ) : user.status === 'deactivated' ? (
        <MenuItem onSelect={() => actions.reactivate(user)}>Reactivate</MenuItem>
      ) : (
        <MenuItem
          tone="danger"
          disabled={user.id === actions.selfId}
          hint={user.id === actions.selfId ? 'You' : undefined}
          onSelect={() => actions.deactivate(user)}
        >
          Deactivate
        </MenuItem>
      )}
    </Menu>
  );
}
