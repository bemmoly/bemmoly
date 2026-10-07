import { Avatar } from './Avatar.tsx';

/** PLACEHOLDER for @bemmoly/ui AvatarStack: overlapping 26px avatars on the team cards. */
export function AvatarStack({ names, max = 4 }: { names: readonly string[]; max?: number }) {
  return (
    <span className="flex pl-1.5">
      {names.slice(0, max).map((name) => (
        <span key={name} className="-ml-1.5">
          <Avatar name={name} size={26} ring />
        </span>
      ))}
    </span>
  );
}
