import { Icon } from '@bemmoly/ui/icons';
import { useId, useState } from 'react';
import { initialsOf } from '../../hooks/use-ai-catalog.ts';
import { LOCAL_DESCRIPTION, NO_AI_OPTION, useSetupAi } from '../../hooks/use-ai-settings.ts';
import { NO_AI } from '../../store/setup.ts';
import { ConnectionShell } from '../ai/connection-shell.tsx';
import { PrivacyRows } from '../ai/privacy-rows.tsx';
import { ProviderList } from '../ai/provider-list.tsx';
import { providerIcon } from '../ai/provider-logo.tsx';
import { ChoiceCard } from './choice-card.tsx';
import { StepFooter, StepForm, type StepNav } from './step-footer.tsx';

type Ai = ReturnType<typeof useSetupAi>;

/**
 * The two answers that need no catalog, first: no AI (the default) or a server on your own
 * hardware. Then the popular providers, and the whole catalog behind one disclosure.
 */
function Choices({ ai }: { ai: Ai }) {
  const { picker } = ai;
  const [browsing, setBrowsing] = useState(false);
  const listId = useId();
  const inCatalog = !picker.popular.some((p) => p.id === ai.choice) && picker.selected;
  const open = browsing || Boolean(inCatalog && ai.choice !== picker.local.id);
  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="Other options" className="grid gap-2.5 sm:grid-cols-2">
        <ChoiceCard
          initials="0"
          icon={<Icon name="minus" size={16} />}
          name={NO_AI_OPTION.name}
          description={NO_AI_OPTION.description}
          selected={ai.choice === NO_AI}
          onSelect={() => ai.pick(NO_AI)}
        />
        <ChoiceCard
          initials={initialsOf(picker.local.name)}
          icon={<Icon name="server" size={16} />}
          name={picker.local.name}
          description={LOCAL_DESCRIPTION}
          badge="Air-gapped"
          selected={ai.choice === picker.local.id}
          onSelect={() => ai.pick(picker.local.id)}
        />
      </div>
      <h2 className="m-0 mt-1 text-13 font-semibold text-tx">Or connect a provider</h2>
      <div
        role="radiogroup"
        aria-label="Popular providers"
        className="grid grid-cols-2 gap-2.5 sm:grid-cols-3"
      >
        {picker.popular.map((provider) => (
          <ChoiceCard
            key={provider.id}
            initials={initialsOf(provider.name)}
            icon={providerIcon(provider.id)}
            name={provider.name}
            selected={ai.choice === provider.id}
            onSelect={() => ai.pick(provider.id)}
          />
        ))}
      </div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setBrowsing(!open)}
        className="flex cursor-pointer items-center gap-1 self-start rounded-chip border-0 bg-transparent p-0 font-sans text-13 font-medium text-acc hover:underline focus-ring"
      >
        {open ? 'Hide the full catalog' : `Browse all ${picker.total} providers`}
        <span className={`flex motion-safe:transition-transform ${open ? 'rotate-180' : ''}`}>
          <Icon name="caret" size={12} />
        </span>
      </button>
      <div id={listId} hidden={!open}>
        {open ? (
          <ProviderList
            query={picker.query}
            onQuery={picker.setQuery}
            status={picker.status}
            results={picker.results}
            total={picker.total}
            selectedId={ai.choice}
            onPick={ai.pick}
          />
        ) : null}
      </div>
    </div>
  );
}

/**
 * AI: nothing by default. Choosing a provider shows its connection form and what AI may see
 * and do; with no AI there is nothing to configure, so neither is shown.
 */
export function StepAi({ nav }: { nav: StepNav }) {
  const ai = useSetupAi(nav.next);
  return (
    <StepForm label="AI" onSubmit={ai.submit} busy={ai.save.isPending}>
      <Choices ai={ai} />
      {ai.choice === NO_AI ? null : (
        <>
          <ConnectionShell picker={ai.picker} />
          <PrivacyRows
            title="What AI may see and do"
            shareContent={ai.shareContent}
            onShareContent={ai.setShareContent}
            allowActions={ai.allowActions}
            onAllowActions={ai.setAllowActions}
          />
        </>
      )}
      <StepFooter nav={nav} loading={ai.save.isPending} error={ai.save.error} />
    </StepForm>
  );
}
