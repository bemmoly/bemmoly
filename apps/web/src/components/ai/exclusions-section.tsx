import { queryKeys } from '@bemmoly/api-client';
import type { AiExclusionTarget, AiPrivacy } from '@bemmoly/shared';
import { Select, SettingsSection, Skeleton, Tag } from '@bemmoly/ui';
import { useQuery } from '@tanstack/react-query';
import type { AiAdminSettings } from '../../hooks/use-ai-admin.ts';
import { api } from '../../lib/api.ts';

const KINDS = {
  space: {
    field: 'excludedSpaceIds',
    title: 'Excluded spaces',
    hint: 'Pages in these spaces are never sent to a provider and never embedded.',
    add: 'Exclude a space…',
    none: 'No space is excluded.',
    unavailable: 'Docs is off, so there are no spaces to exclude.',
  },
  project: {
    field: 'excludedProjectIds',
    title: 'Excluded projects',
    hint: 'Issues in these projects are never sent to a provider and never embedded.',
    add: 'Exclude a project…',
    none: 'No project is excluded.',
    unavailable: 'Work is off, so there are no projects to exclude.',
  },
} as const satisfies Record<
  AiExclusionTarget['kind'],
  { field: keyof AiPrivacy } & Record<string, string>
>;

type Kind = keyof typeof KINDS;

const label = (target: AiExclusionTarget) =>
  target.key ? `${target.name} (${target.key})` : target.name;

function ExclusionRow({
  kind,
  targets,
  admin,
}: {
  kind: Kind;
  targets: readonly AiExclusionTarget[];
  admin: AiAdminSettings;
}) {
  const copy = KINDS[kind];
  const ids = (admin.settings?.privacy[copy.field] ?? []) as string[];
  const ofKind = targets.filter((target) => target.kind === kind);
  const byId = new Map(ofKind.map((target) => [target.id, target]));
  const set = (next: string[], title: string) =>
    admin.change({ privacy: { [copy.field]: next } }, { title });
  const options = ofKind
    .filter((target) => !ids.includes(target.id))
    .map((target) => ({ value: target.id, label: label(target) }));
  return (
    <div className="flex flex-col gap-2 border-b border-line-2 py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-medium text-tx">{copy.title}</span>
          <span className="text-12 text-tx-3">{copy.hint}</span>
        </div>
        {ofKind.length > 0 ? (
          <Select
            aria-label={copy.add}
            options={options}
            placeholder={copy.add}
            searchable
            value=""
            disabled={options.length === 0}
            onChange={(event) =>
              set([...ids, event.value], `${event.option.label} excluded from AI`)
            }
            className="w-56"
          />
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ids.length === 0 ? (
          <span className="text-12 text-tx-3">
            {ofKind.length === 0 ? copy.unavailable : copy.none}
          </span>
        ) : (
          ids.map((id) => {
            const target = byId.get(id);
            const name = target ? label(target) : 'A deleted item';
            return (
              <Tag
                key={id}
                size="lg"
                removeLabel={`Stop excluding ${name}`}
                onRemove={() =>
                  set(
                    ids.filter((entry) => entry !== id),
                    `${name} no longer excluded`,
                  )
                }
              >
                {name}
              </Tag>
            );
          })
        )}
      </div>
    </div>
  );
}

/** Spaces and projects AI never reads, from what each enabled module registers. */
export function ExclusionsSection({ admin }: { admin: AiAdminSettings }) {
  const targets = useQuery({
    queryKey: queryKeys.ai.exclusionTargets(),
    queryFn: () => api.ai.exclusionTargets(),
  });
  return (
    <SettingsSection title="Never send" layout="rows">
      {targets.isPending ? (
        <div aria-busy className="flex flex-col gap-3 py-3">
          <Skeleton width="45%" height={10} />
          <Skeleton width="60%" height={10} />
        </div>
      ) : (
        (['space', 'project'] as const).map((kind) => (
          <ExclusionRow key={kind} kind={kind} targets={targets.data?.items ?? []} admin={admin} />
        ))
      )}
    </SettingsSection>
  );
}
