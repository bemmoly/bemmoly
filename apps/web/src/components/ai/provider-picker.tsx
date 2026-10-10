import { Button, Skeleton } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { initialsOf, type useAiCatalog } from '../../hooks/use-ai-catalog.ts';
import { describeError } from '../../lib/errors.ts';
import { ChoiceCard } from '../setup/choice-card.tsx';
import { ProviderList } from './provider-list.tsx';
import { providerIcon } from './provider-logo.tsx';

export type CatalogView = ReturnType<typeof useAiCatalog>;

interface ProviderPickerProps {
  catalog: CatalogView;
  query: string;
  onQuery: (query: string) => void;
  choice: string | null;
  onPick: (id: string) => void;
  autoFocusSearch?: boolean;
}

function GroupLabel({ children }: { children: string }) {
  return <span className="text-11 font-semibold text-tx-3">{children}</span>;
}

function PickerSkeleton() {
  return (
    <div aria-busy role="status" aria-label="Loading the catalog" className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} height={58} className="rounded-card" />
        ))}
      </div>
      <Skeleton height={32} className="rounded-control" />
      <Skeleton height={200} className="rounded-control" />
    </div>
  );
}

/**
 * The provider choice shared by the wizard and Settings › AI: the Popular row from the
 * catalog (its own names and logos) with Local server last, then the whole catalog, searchable.
 */
export function ProviderPicker({
  catalog,
  query,
  onQuery,
  choice,
  onPick,
  autoFocusSearch,
}: ProviderPickerProps) {
  if (catalog.query.isPending) return <PickerSkeleton />;
  if (catalog.query.error) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 text-13 text-tx-2">
        <Icon name="warning" className="text-amber" />
        <span className="min-w-0 flex-1">
          The provider catalog didn’t load. {describeError(catalog.query.error).message}
        </span>
        <Button size="sm" onClick={() => void catalog.query.refetch()}>
          Try again
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <GroupLabel>Popular</GroupLabel>
      <div
        role="radiogroup"
        aria-label="Popular providers"
        className="grid grid-cols-2 gap-2.5 sm:grid-cols-3"
      >
        {catalog.popular.map((provider) => (
          <ChoiceCard
            key={provider.id}
            initials={initialsOf(provider.name)}
            icon={providerIcon(provider.id, provider.logoUrl)}
            name={provider.name}
            selected={choice === provider.id}
            onSelect={() => onPick(provider.id)}
          />
        ))}
        <ChoiceCard
          initials={initialsOf(catalog.local.name)}
          icon={<Icon name="server" />}
          name={catalog.local.name}
          selected={choice === catalog.local.id}
          onSelect={() => onPick(catalog.local.id)}
        />
      </div>
      <GroupLabel>All providers</GroupLabel>
      <ProviderList
        query={query}
        onQuery={onQuery}
        status={catalog.status.line}
        results={catalog.results}
        total={catalog.total}
        selectedId={choice}
        onPick={onPick}
        autoFocus={autoFocusSearch}
      />
    </div>
  );
}
