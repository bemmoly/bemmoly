import { useT } from '@bemmoly/core-web';
import { Avatar, Badge } from '@bemmoly/ui';
import type { Happening } from '../../../shared/index.ts';
import { peopleText } from '../i18n/catalog.ts';
import { useDateText } from './format.ts';
import { peoplePaths } from './paths.ts';

/** Avatar, name and one line under it; the name links to the profile. */
export function PersonCell({
  userId,
  name,
  detail,
  link = true,
  size = 28,
}: {
  userId: string;
  name: string;
  detail?: string | null;
  link?: boolean;
  size?: number;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Avatar name={name} size={size} />
      <span className="flex min-w-0 flex-col">
        {link ? (
          <a
            href={peoplePaths.profile(userId)}
            className="truncate text-13 font-semibold text-tx no-underline hover:underline"
          >
            {name}
          </a>
        ) : (
          <span className="truncate text-13 font-semibold text-tx">{name}</span>
        )}
        {detail ? <span className="truncate text-12 text-tx-3">{detail}</span> : null}
      </span>
    </span>
  );
}

const TONE = { joining: 'accent', leaving: 'warn', away: 'neutral', away_soon: 'outline' } as const;

/** What is happening to a person, as one badge: joining, leaving, away or away soon. */
export function HappeningBadge({ happening }: { happening: Happening | null }) {
  const t = useT(peopleText);
  const date = useDateText();
  if (!happening) return null;
  const text =
    happening.kind === 'joining'
      ? t('people.happening.joining', { date: date(happening.date) })
      : happening.kind === 'leaving'
        ? t('people.happening.leaving', { date: date(happening.date) })
        : happening.kind === 'away'
          ? t('people.happening.away', { date: date(happening.until) })
          : t('people.happening.awaySoon', { date: date(happening.date) });
  return <Badge tone={TONE[happening.kind]}>{text}</Badge>;
}
