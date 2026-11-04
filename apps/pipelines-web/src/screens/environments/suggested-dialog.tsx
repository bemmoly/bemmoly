import { useT } from '@bemmoly/core-web';
import { Button, Checkbox, Field, Input, Modal, Select } from '@bemmoly/ui';
import { useState } from 'react';
import { useEnvironmentV2Writes, type ReachableProject } from '../../hooks/use-environments-v2.ts';
import { useReturnToChecklist } from '../../hooks/use-setup.ts';
import { environmentsText } from '../../i18n/catalog.ts';
import { ActionError } from '../../parts/action-error.tsx';
import {
  bodyOf,
  countOf,
  draftFor,
  draftReady,
  problemOf,
  tickAvailable,
  type SuggestedDraft,
  type Tick,
  type Which,
} from './suggested-draft.ts';

const NONE = '__none__';

/**
 * Suggested setup: a common starting point as ticks and fields, nothing created until Create.
 * Each ticked environment has its own Name, ID and Project, filled in and editable.
 */
export function SuggestedDialog({
  projects,
  onClose,
}: {
  projects: readonly ReachableProject[];
  onClose: () => void;
}) {
  const t = useT(environmentsText);
  const { applySuggested } = useEnvironmentV2Writes();
  const back = useReturnToChecklist();
  const [draft, setDraft] = useState<SuggestedDraft>(() =>
    draftFor(projects.map((project) => project.externalId)),
  );
  const env = draft.env;
  const tick = (key: Tick) =>
    setDraft((now) => ({ ...now, ticks: { ...now.ticks, [key]: !now.ticks[key] } }));
  const edit = (which: Which, patch: Partial<SuggestedDraft['env'][Which]>) =>
    setDraft((now) => ({ ...now, env: { ...now.env, [which]: { ...now.env[which], ...patch } } }));
  const groupName = (name: string) => t('pipelinesEnvironments.suggest.groupName', { name });
  const count = countOf(draft);
  const ready = draftReady(draft);
  const path = (['dev', 'stage', 'prod'] as const)
    .filter((which) => draft.ticks[which])
    .map((which) => env[which].name);
  const options = [
    { value: NONE, label: t('pipelinesEnvironments.suggest.noProject') },
    ...projects.map((project) => ({ value: project.externalId, label: project.externalId })),
  ];
  const create = () => {
    if (!ready) return;
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const body = bodyOf(draft, groupName, timeZone);
    applySuggested.mutate(body, {
      onSuccess: (applied) =>
        void back(
          t('pipelinesEnvironments.suggest.created', {
            count: body.environments.length,
            groups: applied.groups.length ? applied.groups.map((g) => g.name).join(', ') : 'none',
          }),
        ),
    });
  };

  const box = (key: Tick, label: string, description: string) => (
    <Checkbox
      checked={draft.ticks[key] && tickAvailable(draft, key)}
      disabled={!tickAvailable(draft, key)}
      onChange={() => tick(key)}
      label={label}
      description={description}
    />
  );

  const environment = (which: Which, description: string) => {
    const problem = problemOf(draft, which);
    return (
      <div
        role="group"
        aria-label={t(`pipelinesEnvironments.suggest.group.${which}`)}
        className="flex flex-col gap-2 rounded-control border border-line px-3.5 py-3"
      >
        {box(
          which,
          env[which].name || t(`pipelinesEnvironments.suggest.group.${which}`),
          description,
        )}
        {draft.ticks[which] && (
          <div className="grid grid-cols-1 gap-2 ps-6.5 sm:grid-cols-[1fr_1fr_1.3fr]">
            <Field label={t('pipelinesEnvironments.suggest.name')}>
              <Input
                value={env[which].name}
                onChange={(e) => edit(which, { name: e.target.value })}
              />
            </Field>
            <Field
              label={t('pipelinesEnvironments.suggest.id')}
              error={
                problem === 'id'
                  ? t('pipelinesEnvironments.suggest.idInvalid')
                  : problem === 'taken'
                    ? t('pipelinesEnvironments.suggest.idTaken')
                    : null
              }
            >
              <Input
                mono
                value={env[which].id}
                onChange={(e) => edit(which, { id: e.target.value.toLowerCase() })}
              />
            </Field>
            <Field label={t('pipelinesEnvironments.suggest.project')}>
              <Select
                options={options}
                value={env[which].project || NONE}
                onChange={(event) =>
                  edit(which, { project: event.value === NONE ? '' : event.value })
                }
              />
            </Field>
          </div>
        )}
      </div>
    );
  };

  const wrap = (child: ReturnType<typeof box>) => (
    <div className="rounded-control border border-line px-3.5 py-3">{child}</div>
  );

  return (
    <Modal
      open
      width="lg"
      onClose={onClose}
      title={t('pipelinesEnvironments.suggest.title')}
      description={t('pipelinesEnvironments.suggest.intro')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('pipelinesEnvironments.suggest.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={!ready || count === 0}
            loading={applySuggested.isPending}
            onClick={create}
          >
            {t('pipelinesEnvironments.suggest.create', { count })}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        {environment('dev', t('pipelinesEnvironments.suggest.devHint'))}
        {environment(
          'stage',
          t('pipelinesEnvironments.suggest.stageHint', { previous: env.dev.name }),
        )}
        {environment(
          'prod',
          t('pipelinesEnvironments.suggest.prodHint', { previous: env.stage.name }),
        )}
        {wrap(
          box(
            'order',
            t('pipelinesEnvironments.suggest.order', {
              path: path.length
                ? path.reduce((all, name) =>
                    t('pipelinesEnvironments.suggest.then', { first: all, second: name }),
                  )
                : '',
            }),
            t('pipelinesEnvironments.suggest.orderHint'),
          ),
        )}
        {wrap(
          box(
            'prodApproval',
            t('pipelinesEnvironments.suggest.prodApproval', { name: env.prod.name }),
            t('pipelinesEnvironments.suggest.prodApprovalHint', {
              group: groupName(env.prod.name),
            }),
          ),
        )}
        {wrap(
          box(
            'stageApproval',
            t('pipelinesEnvironments.suggest.stageApproval', { name: env.stage.name }),
            t('pipelinesEnvironments.suggest.stageApprovalHint', {
              group: groupName(env.stage.name),
            }),
          ),
        )}
        {wrap(
          box(
            'window',
            t('pipelinesEnvironments.suggest.window', { name: env.prod.name }),
            t('pipelinesEnvironments.suggest.windowHint'),
          ),
        )}
        <ActionError error={applySuggested.error} />
      </div>
    </Modal>
  );
}
