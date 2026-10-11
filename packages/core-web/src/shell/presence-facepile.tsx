import { Avatar, Tooltip, type AvatarHue } from '@bemmoly/ui';

/** One person on the same view, named and placed for the tooltip. */
export interface PresencePerson {
  /** Unique within the pile: a person may show once per view. */
  id: string;
  name: string;
  /** Where they are, in words: "on the board", "viewing PLT-204". */
  where: string;
  hue?: AvatarHue;
}

export interface PresenceFacepileProps {
  people: readonly PresencePerson[];
  /** Faces before the "+N" chip. */
  max?: number;
}

const SIZE = 22;
/** How many names the "+N" tooltip spells out before it counts the rest. */
const NAMED = 5;

const line = (person: PresencePerson) => `${person.name} · ${person.where}`;

function restLabel(rest: readonly PresencePerson[]): string {
  const named = rest.slice(0, NAMED).map(line);
  const more = rest.length - named.length;
  return more > 0 ? `${named.join(', ')} and ${more} more` : named.join(', ');
}

/**
 * Who else is here, in the page header (docs/design/premium/kit.css, `.facepile`): up to three
 * 22px faces overlapping by 5px, each ringed in the header's canvas, then "+N". Each face names
 * the person and where they are on hover and keyboard focus. Nothing is drawn when alone, and
 * faces fade in as people arrive (not at all under reduced motion).
 */
export function PresenceFacepile({ people, max = 3 }: PresenceFacepileProps) {
  if (people.length === 0) return null;
  const shown = people.slice(0, max);
  const rest = people.slice(max);
  return (
    <div
      role="group"
      aria-label={`Also here: ${people.map(line).join(', ')}`}
      className="flex items-center pl-1.25"
      data-presence
    >
      {shown.map((person) => (
        <Tooltip key={person.id} label={line(person)} side="bottom">
          <Avatar
            name={person.name}
            size={SIZE}
            title=""
            tabIndex={0}
            className="-ml-1.25 ring-2 ring-canvas focus-ring motion-safe:animate-fade-in"
            {...(person.hue ? { hue: person.hue } : {})}
          />
        </Tooltip>
      ))}
      {rest.length > 0 ? (
        <Tooltip label={restLabel(rest)} side="bottom">
          <span
            role="img"
            tabIndex={0}
            aria-label={`${rest.length} more: ${rest.map((person) => person.name).join(', ')}`}
            className="-ml-1.25 inline-flex h-5.5 min-w-5.5 items-center justify-center rounded-full bg-line-2 px-1 text-11 font-semibold text-tx-2 tabular-nums ring-2 ring-canvas focus-ring motion-safe:animate-fade-in"
          >
            +{rest.length}
          </span>
        </Tooltip>
      ) : null}
    </div>
  );
}
