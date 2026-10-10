import { SearchInput } from '@bemmoly/ui';
import type { CatalogProvider } from '../../hooks/use-ai-catalog.ts';
import { ProviderLogo } from './provider-logo.tsx';

interface ProviderListProps {
  query: string;
  onQuery: (query: string) => void;
  status: string;
  results: readonly CatalogProvider[];
  total: number;
  selectedId: string | null;
  onPick: (id: string) => void;
  disabled?: boolean;
}

/** The full catalog under the Popular row: a search box, the status line and a scrolling list. */
export function ProviderList({
  query,
  onQuery,
  status,
  results,
  total,
  selectedId,
  onPick,
  disabled,
}: ProviderListProps) {
  const shown = results.length === total ? `${total} providers` : `${results.length} of ${total}`;
  return (
    <div className="flex flex-col gap-2">
      <SearchInput
        aria-label="Search providers"
        placeholder="Search all providers by name or id"
        value={query}
        onChange={(event) => onQuery(event.target.value)}
      />
      <span className="text-12 text-tx-3">
        {status} · {shown}
      </span>
      <div
        role="radiogroup"
        aria-label="All providers"
        className="flex max-h-66 flex-col overflow-y-auto rounded-control border border-line bg-card"
      >
        {results.length === 0 ? (
          <span className="px-3 py-3 text-13 text-tx-3">No provider matches “{query.trim()}”.</span>
        ) : (
          results.map((provider) => {
            const selected = provider.id === selectedId;
            return (
              <button
                key={provider.id}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => onPick(provider.id)}
                className={`flex w-full shrink-0 cursor-pointer items-center gap-2.5 border-0 border-b border-line-2 px-3 py-2 text-left font-sans text-13 outline-0 last:border-b-0 focus-visible:shadow-ring disabled:cursor-not-allowed ${
                  selected ? 'bg-acc-50' : 'bg-transparent hover:bg-side'
                }`}
              >
                <ProviderLogo id={provider.id} name={provider.name} />
                <span className={`font-medium ${selected ? 'text-acc' : 'text-tx'}`}>
                  {provider.name}
                </span>
                <span className="ml-auto font-mono text-12 text-tx-3">{provider.id}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
