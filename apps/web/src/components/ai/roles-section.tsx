import type { AiRole } from '@bemmoly/shared';
import {
  Select,
  SettingsSection,
  Skeleton,
  type SelectGroup,
  type SelectOption,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import {
  eligibleFor,
  optionValue,
  ROLE_COPY,
  type AiRoles,
  type RoleModel,
} from '../../hooks/use-ai-roles.ts';
import { ModelFacts, modelSummary } from './model-facts.tsx';

/** A role's options, one group per connected provider, the suggested model first. */
export function roleGroups(role: AiRole, models: readonly RoleModel[]): SelectGroup[] {
  const groups = new Map<string, { label: string; options: SelectOption[] }>();
  for (const entry of models) {
    const group = groups.get(entry.providerId) ?? { label: entry.providerName, options: [] };
    group.options.push({
      value: optionValue(entry.providerId, entry.model.id),
      label: entry.model.name,
      description: modelSummary(entry.model, role),
    });
    groups.set(entry.providerId, group);
  }
  return [...groups.values()];
}

function Warning({ children }: { children: string }) {
  return (
    <span className="flex items-start gap-1.5 text-12 text-amber-tx">
      <Icon name="warning" size={14} className="mt-px shrink-0" />
      {children}
    </span>
  );
}

function RoleRow({ role, roles, disabled }: { role: AiRole; roles: AiRoles; disabled?: boolean }) {
  const current = roles.assignment(role);
  const eligible = eligibleFor(role, roles.models, current);
  const value = roles.valueOf(role);
  const chosen = roles.models.find(
    (entry) => optionValue(entry.providerId, entry.model.id) === value,
  );
  const copy = ROLE_COPY[role];
  return (
    <div className="grid gap-x-6 gap-y-2 border-b border-line-2 py-3 last:border-b-0 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium text-tx">{copy.label}</span>
        <span className="text-12 text-tx-3">{copy.description}</span>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <Select
          aria-label={`Model for the ${copy.label.toLowerCase()} role`}
          groups={roleGroups(role, eligible)}
          value={value ?? undefined}
          placeholder={eligible.length === 0 ? 'No connected model fits' : 'Choose a model'}
          searchPlaceholder="Search models"
          disabled={disabled || eligible.length === 0 || roles.pendingRole === role}
          onChange={(event) => roles.choose(role, event.value)}
          className="w-full"
        />
        {chosen ? <ModelFacts model={chosen.model} role={role} /> : null}
        {current?.paused ? (
          <Warning>
            Paused: this month’s budget is spent. It starts again on the 1st, or when the budget is
            raised.
          </Warning>
        ) : null}
        {current?.deprecation ? (
          <Warning>
            {`The catalog marks this model deprecated.${
              current.deprecation.successor ? ` ${current.deprecation.successor} replaces it.` : ''
            }`}
          </Warning>
        ) : null}
        {eligible.length === 0 && roles.models.length > 0 ? (
          <span className="text-12 text-tx-3">
            {role === 'strong'
              ? 'Strong needs a model with tool calling. Connect a provider that has one.'
              : role === 'embedding'
                ? 'None of the connected providers offers an embedding model.'
                : 'None of the connected providers offers a text model.'}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Fast, standard, strong and embedding: one select each, filtered to the models that fit. */
export function RolesSection({ roles, disabled }: { roles: AiRoles; disabled?: boolean }) {
  return (
    <SettingsSection title="Model roles" hint="Changes apply at once, with Undo" layout="rows">
      {roles.loading
        ? roles.order.map((role) => (
            <div
              key={role}
              aria-hidden
              className="grid gap-6 border-b border-line-2 py-3.5 last:border-b-0 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
            >
              <Skeleton width="40%" height={10} />
              <Skeleton height={32} className="rounded-control" />
            </div>
          ))
        : roles.order.map((role) => (
            <RoleRow key={role} role={role} roles={roles} disabled={disabled} />
          ))}
    </SettingsSection>
  );
}
