import type { OAuthAccess, OAuthClientSummary, OAuthModuleOption } from '@bemmoly/shared';
import { Checkbox, EntityTile, Radio } from '@bemmoly/ui';
import { Icon, type IconName } from '@bemmoly/ui/icons';
import type { ReactNode } from 'react';

function Fact({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <li className="flex min-w-0 items-start gap-2 text-13 leading-body text-tx-2">
      <span className="mt-0.5 flex shrink-0 text-tx-3">
        <Icon name={icon} size={14} />
      </span>
      <span className="min-w-0 break-words">{children}</span>
    </li>
  );
}

/**
 * Who is asking: the app's name, the site whose document vouches for it, and where the browser
 * goes next. The hosts are shown in full because they, not the name, are what can be trusted.
 */
export function ClientCard({ client }: { client: OAuthClientSummary }) {
  return (
    <section
      aria-label="The app asking for access"
      className="flex flex-col gap-3 rounded-card bg-card px-4 py-3.5 shadow-[inset_0_0_0_1px_var(--line)]"
    >
      <div className="flex min-w-0 items-center gap-3">
        <EntityTile name={client.name} size={36} tone="ink" />
        <div className="min-w-0">
          <b className="block truncate text-14 font-semibold">{client.name}</b>
          <span className="block truncate text-13 text-tx-2">MCP client</span>
        </div>
      </div>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        <Fact icon="globe">
          Published by <b className="font-medium text-tx">{client.host}</b>
        </Fact>
        <Fact icon={client.loopback ? 'monitor' : 'link'}>
          Sends you back to <b className="font-medium text-tx">{client.redirectHost}</b>
        </Fact>
      </ul>
    </section>
  );
}

interface AccessChoiceProps {
  /** The most the app asked for. */
  offered: OAuthAccess;
  value: OAuthAccess;
  onChange: (access: OAuthAccess) => void;
}

/** Read only, or read and write when the app asked for it; never more. */
export function AccessChoice({ offered, value, onChange }: AccessChoiceProps) {
  return (
    <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
      <legend className="mb-2 p-0 text-13 font-semibold text-tx">What it can do</legend>
      <Radio
        name="oauth-access"
        label="Read only"
        description="Search and read issues and pages you can open."
        checked={value === 'read'}
        onChange={() => onChange('read')}
      />
      {offered === 'write' ? (
        <Radio
          name="oauth-access"
          label="Read and write"
          description="Also create and change things, as you. Your client asks before each change."
          checked={value === 'write'}
          onChange={() => onChange('write')}
        />
      ) : null}
    </fieldset>
  );
}

interface ModulesChoiceProps {
  options: readonly OAuthModuleOption[];
  chosen: readonly string[];
  onToggle: (id: string) => void;
  error: string | null;
}

/** The modules it may reach, from the ones the app asked for and you can open. */
export function ModulesChoice({ options, chosen, onToggle, error }: ModulesChoiceProps) {
  return (
    <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
      <legend className="mb-2 p-0 text-13 font-semibold text-tx">Where</legend>
      {options.map((option) => (
        <Checkbox
          key={option.id}
          label={option.name}
          checked={chosen.includes(option.id)}
          onChange={() => onToggle(option.id)}
        />
      ))}
      {error ? (
        <span role="alert" className="text-12 text-red-tx">
          {error}
        </span>
      ) : null}
    </fieldset>
  );
}
