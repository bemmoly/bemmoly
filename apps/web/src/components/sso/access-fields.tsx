import { queryKeys } from '@bemmoly/api-client';
import { Button, Field, IconButton, Input, Select, SettingsRow, Switch } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useQuery } from '@tanstack/react-query';
import type { SsoProviderForm } from '../../hooks/use-sso-provider-form.ts';
import { api } from '../../lib/api.ts';

interface Option {
  value: string;
  label: string;
}

interface MappingRowsProps {
  label: string;
  rows: { group: string; target: string }[];
  options: Option[];
  targetLabel: string;
  onChange: (rows: { group: string; target: string }[]) => void;
  disabled?: boolean;
}

/** Group to role, or group to team: one row each, in order; the first match wins for roles. */
function MappingRows({ label, rows, options, targetLabel, onChange, disabled }: MappingRowsProps) {
  const update = (index: number, patch: Partial<{ group: string; target: string }>) =>
    onChange(rows.map((row, at) => (at === index ? { ...row, ...patch } : row)));
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend className="mb-1.5 text-13 font-medium text-tx">{label}</legend>
      {rows.map((row, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            aria-label={`Group ${index + 1}`}
            value={row.group}
            placeholder="Group name"
            disabled={disabled}
            className="min-w-0 flex-1"
            onChange={(event) => update(index, { group: event.target.value })}
          />
          <Icon name="arrow" size={14} className="shrink-0 text-tx-3" />
          <Select
            aria-label={`${targetLabel} for group ${index + 1}`}
            value={row.target}
            placeholder={`Choose a ${targetLabel.toLowerCase()}`}
            options={options}
            disabled={disabled}
            className="min-w-0 flex-1"
            onChange={(event) => update(index, { target: event.value })}
          />
          <IconButton
            icon="close"
            size="xs"
            label={`Remove mapping ${index + 1}`}
            disabled={disabled}
            onClick={() => onChange(rows.filter((_, at) => at !== index))}
          />
        </div>
      ))}
      <Button
        size="xs"
        variant="ghost"
        icon={<Icon name="plus" />}
        disabled={disabled}
        className="self-start"
        onClick={() => onChange([...rows, { group: '', target: '' }])}
      >
        Add mapping
      </Button>
    </fieldset>
  );
}

/** Who may sign in and what they get: provisioning, domains, and group mappings. */
export function AccessFields({ form, disabled }: { form: SsoProviderForm; disabled?: boolean }) {
  const { draft, set, errors } = form;
  const roles = useQuery({ queryKey: queryKeys.roles(), queryFn: () => api.roles.list() });
  const teams = useQuery({ queryKey: queryKeys.teams.all(), queryFn: () => api.teams.list() });
  const roleOptions = (roles.data?.items ?? []).map((role) => ({
    value: role.id,
    label: role.name,
  }));
  const teamOptions = (teams.data?.items ?? []).map((team) => ({
    value: team.id,
    label: team.name,
  }));
  return (
    <div className="flex flex-col gap-4">
      <div>
        <SettingsRow
          title="Create accounts on first sign-in"
          description="Off: only people who already have an account here can sign in."
          control={
            <Switch
              aria-label="Create accounts on first sign-in"
              checked={draft.autoProvision}
              disabled={disabled}
              onCheckedChange={set('autoProvision')}
            />
          }
        />
      </div>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Role for new people" hint="Unless a group below maps them to another.">
          <Select
            value={draft.defaultRoleId}
            placeholder="Viewer (the default)"
            options={roleOptions}
            disabled={disabled}
            onChange={(event) => set('defaultRoleId')(event.value)}
          />
        </Field>
        <Field
          label="Allowed email domains"
          hint="Comma separated. Empty allows any address the provider vouches for."
          error={errors['allowedDomains'] ?? errors['allowedDomains.0']}
        >
          <Input
            value={draft.domains}
            placeholder="acme.dev"
            disabled={disabled}
            spellCheck={false}
            onChange={(event) => set('domains')(event.target.value)}
          />
        </Field>
      </div>
      <MappingRows
        label="Groups to roles"
        targetLabel="Role"
        options={roleOptions}
        disabled={disabled}
        rows={draft.roleMappings.map((row) => ({ group: row.group, target: row.roleId }))}
        onChange={(rows) =>
          set('roleMappings')(rows.map((row) => ({ group: row.group, roleId: row.target })))
        }
      />
      <MappingRows
        label="Groups to teams"
        targetLabel="Team"
        options={teamOptions}
        disabled={disabled}
        rows={draft.teamMappings.map((row) => ({ group: row.group, target: row.teamId }))}
        onChange={(rows) =>
          set('teamMappings')(rows.map((row) => ({ group: row.group, teamId: row.target })))
        }
      />
      <p className="m-0 text-12 leading-body text-tx-3">
        Mappings apply on every sign-in. A matched role replaces the current one; teams named here
        follow the person&apos;s groups, and other teams are left alone.
      </p>
    </div>
  );
}
