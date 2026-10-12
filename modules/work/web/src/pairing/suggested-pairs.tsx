import type { PairingMatrix, PairingSuggestion } from '@bemmoly/module-work/shared';
import { Avatar, RelativeTime } from '@bemmoly/ui';

/*
 * The next pairs the workspace suggests, shown only while the setting is on: people who never
 * paired first, then those who paired least and longest ago. Each opens its pair below.
 */

export interface SuggestedPairsProps {
  matrix: PairingMatrix;
  suggestions: readonly PairingSuggestion[];
  onOpen: (a: string, b: string) => void;
}

export function SuggestedPairs({ matrix, suggestions, onOpen }: SuggestedPairsProps) {
  if (suggestions.length === 0) return null;
  const name = (id: string) => matrix.people.find((person) => person.id === id)?.name ?? 'Someone';
  return (
    <section aria-labelledby="suggested-pairs" className="mb-4">
      <h2 id="suggested-pairs" className="m-0 mb-2 text-13 font-semibold text-tx">
        Suggested pairs
      </h2>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {suggestions.map((pair) => (
          <li key={`${pair.a},${pair.b}`}>
            <button
              type="button"
              onClick={() => onOpen(pair.a, pair.b)}
              className="inline-flex cursor-pointer items-center gap-2 rounded-control border border-line bg-card px-2.5 py-1.5 text-13 text-tx hover:bg-hover focus-ring"
            >
              <Avatar name={name(pair.a)} size={20} />
              <Avatar name={name(pair.b)} size={20} />
              <span>
                {name(pair.a)} and {name(pair.b)}
              </span>
              <span className="text-12 text-tx-3">
                {pair.lastPairedAt ? (
                  <>
                    last paired <RelativeTime iso={pair.lastPairedAt} />
                  </>
                ) : (
                  'never paired'
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
