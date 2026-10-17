import { useT } from '@bemmoly/core-web';
import type { PolicyRequirements } from '@bemmoly/module-pipelines/shared';
import { Button, Checkbox, IconButton, Input, Select, type SelectOption } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useQuery } from '@tanstack/react-query';
import { pipelinesKeys } from '../../../api/pipelines.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { api } from '../../../lib/api.ts';

export type ApprovalRule = PolicyRequirements['approvals'][number];

/** Who an approval may come from: the owning team, a role, a team, or an on-call schedule. */
function useSources(rules: readonly ApprovalRule[]): SelectOption[] {
  const t = useT(pipelinesText);
  const teams = useQuery({
    queryKey: pipelinesKeys.teams(false),
    queryFn: () => api.pipelines.teams(false),
    staleTime: 5 * 60_000,
  });
  const fixed: SelectOption[] = [
    { value: 'owning_team', label: t('pipelines.policy.owningTeam') },
    {
      value: 'role:release_manager',
      label: t('pipelines.policy.fromRole', { role: t('pipelines.role.release_manager') }),
    },
    {
      value: 'role:maintainer',
      label: t('pipelines.policy.fromRole', { role: t('pipelines.role.maintainer') }),
    },
    {
      value: 'role:platform_admin',
      label: t('pipelines.policy.fromRole', { role: t('pipelines.role.platform_admin') }),
    },
  ];
  const oncall = rules
    .map((rule) => rule.from)
    .filter((from) => from.startsWith('oncall:'))
    .map((from) => ({
      value: from,
      label: t('pipelines.policy.onCall', { schedule: from.slice(7) }),
    }));
  const named = (teams.data?.items ?? []).map((team) => ({
    value: `team:${team.id}`,
    label: team.name,
  }));
  return [...fixed, ...oncall, ...named];
}

/** The approvals a policy asks for, one row each: from whom, how many, never the author. */
export function ApprovalRules({
  rules,
  onChange,
}: {
  rules: readonly ApprovalRule[];
  onChange: (rules: ApprovalRule[]) => void;
}) {
  const t = useT(pipelinesText);
  const sources = useSources(rules);
  const set = (index: number, rule: Partial<ApprovalRule>) =>
    onChange(rules.map((current, at) => (at === index ? { ...current, ...rule } : current)));
  return (
    <div className="flex flex-col gap-2">
      {rules.map((rule, index) => (
        <div key={index} className="flex flex-wrap items-center gap-2">
          <Input
            type="number"
            min={1}
            max={10}
            value={rule.count}
            aria-label={t('pipelines.policy.count')}
            className="w-16"
            onChange={(event) =>
              set(index, { count: Math.max(1, Number(event.target.value) || 1) })
            }
          />
          <Select
            value={rule.from}
            searchable
            options={sources}
            aria-label={t('pipelines.policy.from')}
            className="min-w-48 flex-1"
            onChange={(event) => set(index, { from: event.value as ApprovalRule['from'] })}
          />
          <Checkbox
            checked={rule.exclude.includes('authors')}
            label={t('pipelines.policy.notAuthor')}
            onChange={(event) => set(index, { exclude: event.target.checked ? ['authors'] : [] })}
          />
          <IconButton
            size="sm"
            icon="close"
            label={t('pipelines.policy.removeApproval')}
            onClick={() => onChange(rules.filter((_, at) => at !== index))}
          />
        </div>
      ))}
      <Button
        size="xs"
        variant="ghost"
        className="self-start"
        onClick={() =>
          onChange([...rules, { from: 'owning_team', count: 1, exclude: ['authors'] }])
        }
      >
        <Icon name="plus" size={14} />
        {t('pipelines.policy.addApproval')}
      </Button>
    </div>
  );
}
