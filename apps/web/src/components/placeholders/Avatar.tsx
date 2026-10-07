import { initials } from '@bemmoly/core-web';

/**
 * PLACEHOLDER for @bemmoly/ui Avatar. The mocks give each person a pastel
 * pair; until that palette ships as tokens every avatar uses the accent pair
 * (the mock's own "RS").
 */
export interface AvatarProps {
  name: string;
  size?: 26 | 30 | 32;
  ring?: boolean;
}

const SIZES = { 26: 'size-6.5 text-micro', 30: 'size-7.5 text-mono', 32: 'size-8 text-caption' };

export function Avatar({ name, size = 30, ring }: AvatarProps) {
  return (
    <span
      title={name}
      className={`grid shrink-0 place-items-center rounded-full bg-ac-av font-semibold text-ac ${SIZES[size]} ${
        ring ? 'border-2 border-sf' : ''
      }`}
    >
      {initials(name)}
    </span>
  );
}
