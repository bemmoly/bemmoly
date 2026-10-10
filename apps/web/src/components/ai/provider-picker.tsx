import { Icon } from '@bemmoly/ui/icons';
import { initialsOf } from '../../hooks/use-ai-catalog.ts';
import { LOCAL_DESCRIPTION, NO_AI_OPTION, type useSetupAi } from '../../hooks/use-ai-settings.ts';
import type { AiChoice } from '../../store/setup.ts';
import { ChoiceCard } from '../setup/choice-card.tsx';
import { ProviderList } from './provider-list.tsx';
import { providerIcon } from './provider-logo.tsx';

export type Picker = ReturnType<typeof useSetupAi>['picker'];

interface ProviderPickerProps {
  picker: Picker;
  choice: AiChoice;
  onPick: (choice: AiChoice) => void;
  disabled?: boolean;
}

function GroupLabel({ children }: { children: string }) {
  return (
    <span className="text-11 font-semibold tracking-label text-tx5 uppercase">{children}</span>
  );
}

/**
 * The provider choice shared by the wizard and Settings › AI: the Popular row,
 * the whole catalog beneath it, then a local server or no AI at all.
 */
export function ProviderPicker({ picker, choice, onPick, disabled }: ProviderPickerProps) {
  return (
    <div className="flex flex-col gap-3">
      <GroupLabel>Popular</GroupLabel>
      <div role="radiogroup" aria-label="Popular providers" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {picker.popular.map((provider) => (
          <ChoiceCard
            key={provider.id}
            initials={initialsOf(provider.name)}
            icon={providerIcon(provider.id)}
            name={provider.name}
            detail={provider.id}
            selected={choice === provider.id}
            onSelect={() => onPick(provider.id)}
            disabled={disabled}
          />
        ))}
      </div>
      <GroupLabel>All providers</GroupLabel>
      <ProviderList
        query={picker.query}
        onQuery={picker.setQuery}
        status={picker.status}
        results={picker.results}
        total={picker.total}
        selectedId={choice}
        onPick={onPick}
        disabled={disabled}
      />
      <div role="radiogroup" aria-label="Other options" className="grid grid-cols-2 gap-3">
        <ChoiceCard
          initials={initialsOf(picker.local.name)}
          icon={<Icon name="server" size={16} />}
          name={picker.local.name}
          description={LOCAL_DESCRIPTION}
          badge="AIR-GAPPED"
          selected={choice === picker.local.id}
          onSelect={() => onPick(picker.local.id)}
          disabled={disabled}
        />
        <ChoiceCard
          initials="—"
          name={NO_AI_OPTION.name}
          description={NO_AI_OPTION.description}
          selected={choice === NO_AI_OPTION.id}
          onSelect={() => onPick(NO_AI_OPTION.id)}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
