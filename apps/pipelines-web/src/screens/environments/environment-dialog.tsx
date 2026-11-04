import { useT } from '@bemmoly/core-web';
import type { EnvironmentV2View } from '@bemmoly/module-pipelines/shared';
import { Button, Field, Input, Modal, SegmentedControl, Select, Switch } from '@bemmoly/ui';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import {
  useApprovalGroups,
  useEnvironmentV2Writes,
  type ReachableProject,
} from '../../hooks/use-environments-v2.ts';
import { useReturnToChecklist } from '../../hooks/use-setup.ts';
import { environmentsText } from '../../i18n/catalog.ts';
import { ActionError } from '../../parts/action-error.tsx';
import {
  createBodyOf,
  draftOf,
  draftReady,
  keyOf,
  keyValid,
  NEW_DRAFT,
  updateBodyOf,
  type EnvironmentDraft,
} from './environment-draft.ts';
import { approvalText } from './words.ts';

const NONE = '__none__';

/** Add an environment (every setting off) or Edit one; mounted per opening. */
export function EnvironmentDialog({
  environment,
  projects,
  onClose,
}: {
  environment: EnvironmentV2View | null;
  projects: readonly ReachableProject[];
  onClose: () => void;
}) {
  const t = useT(environmentsText);
  const writes = useEnvironmentV2Writes();
  const groups = useApprovalGroups().data ?? [];
  const back = useReturnToChecklist();
  const [draft, setDraft] = useState<EnvironmentDraft>(
    environment ? draftOf(environment) : NEW_DRAFT,
  );
  const set = (patch: Partial<EnvironmentDraft>) => setDraft((now) => ({ ...now, ...patch }));
  const write = environment ? writes.update : writes.create;
  const ready = draftReady(draft);
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const save = () => {
    if (!ready) return;
    const name = draft.name.trim();
    if (environment) {
      writes.update.mutate(
        { key: environment.key, body: updateBodyOf(draft) },
        { onSuccess: () => onClose() },
      );
    } else {
      writes.create.mutate(createBodyOf(draft), {
        onSuccess: () => void back(t('pipelinesEnvironments.dialog.added', { name })).then(onClose),
      });
    }
  };
  const remove = () =>
    environment && writes.remove.mutate(environment.key, { onSuccess: () => onClose() });
  return (
    <Modal
      open
      onClose={onClose}
      title={
        environment
          ? t('pipelinesEnvironments.dialog.editTitle', { name: environment.name })
          : t('pipelinesEnvironments.dialog.addTitle')
      }
      description={environment ? undefined : t('pipelinesEnvironments.dialog.addIntro')}
      footer={
        <>
          {environment && (
            <Button
              variant="danger"
              className="me-auto"
              loading={writes.remove.isPending}
              onClick={remove}
            >
              {t('pipelinesEnvironments.dialog.remove')}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            {t('pipelinesEnvironments.dialog.cancel')}
          </Button>
          <Button variant="primary" disabled={!ready} loading={write.isPending} onClick={save}>
            {environment
              ? t('pipelinesEnvironments.dialog.save')
              : t('pipelinesEnvironments.dialog.add')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t('pipelinesEnvironments.dialog.name')}>
            <Input
              autoFocus
              value={draft.name}
              placeholder={t('pipelinesEnvironments.dialog.nameExample')}
              onChange={(e) => set({ name: e.target.value })}
            />
          </Field>
          <Field
            label={t('pipelinesEnvironments.dialog.id')}
            error={
              keyOf(draft) && !keyValid(draft) ? t('pipelinesEnvironments.suggest.idInvalid') : null
            }
          >
            <Input
              mono
              value={keyOf(draft)}
              onChange={(e) => set({ key: e.target.value.toLowerCase() })}
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.4fr_1fr]">
          <Field label={t('pipelinesEnvironments.dialog.project')}>
            <Select
              value={draft.project || NONE}
              onChange={(e) => set({ project: e.value === NONE ? '' : e.value })}
              options={[
                { value: NONE, label: t('pipelinesEnvironments.suggest.noProject') },
                ...projects.map((p) => ({ value: p.externalId, label: p.externalId })),
              ]}
            />
          </Field>
          <Field
            label={t('pipelinesEnvironments.dialog.region')}
            hint={t('pipelinesEnvironments.dialog.regionHint')}
          >
            <Input mono value={draft.region} onChange={(e) => set({ region: e.target.value })} />
          </Field>
        </div>
        <Field label={t('pipelinesEnvironments.card.deployers')}>
          <Select
            value={draft.deployerGroup || NONE}
            onChange={(e) => set({ deployerGroup: e.value === NONE ? '' : e.value })}
            options={[
              { value: NONE, label: t('pipelinesEnvironments.value.anyone') },
              ...groups.map((g) => ({ value: g.id, label: g.name })),
            ]}
          />
        </Field>
        <div className="flex flex-col gap-1 text-13">
          <span className="font-medium text-tx">{t('pipelinesEnvironments.dialog.approval')}</span>
          <span className="text-tx-2">
            {environment ? approvalText(t, environment) : t('pipelinesEnvironments.value.off')} ·{' '}
            <Link to={'/platform/approvals' as '/'} className="font-medium text-acc">
              {t('pipelinesEnvironments.dialog.approvalHint')}
            </Link>
          </span>
        </div>
        <label className="flex items-center gap-2.5 font-medium text-tx">
          <Switch
            checked={draft.window !== null}
            aria-label={t('pipelinesEnvironments.dialog.window')}
            onCheckedChange={(on) =>
              set({
                window: on
                  ? { days: 'weekdays', from: '10:00', to: '18:00', timeZone: zone }
                  : null,
              })
            }
          />
          {t('pipelinesEnvironments.dialog.window')}
        </label>
        {draft.window && (
          <div className="grid grid-cols-1 gap-3 ps-6 sm:grid-cols-3">
            <Field label={t('pipelinesEnvironments.window.days')}>
              <SegmentedControl
                aria-label={t('pipelinesEnvironments.window.days')}
                value={draft.window.days}
                onChange={(days) => draft.window && set({ window: { ...draft.window, days } })}
                options={[
                  { value: 'weekdays', label: t('pipelinesEnvironments.value.weekdays') },
                  { value: 'every', label: t('pipelinesEnvironments.value.everyDay') },
                ]}
              />
            </Field>
            <Field label={t('pipelinesEnvironments.window.from')}>
              <Input
                mono
                value={draft.window.from}
                onChange={(e) =>
                  draft.window && set({ window: { ...draft.window, from: e.target.value } })
                }
              />
            </Field>
            <Field label={t('pipelinesEnvironments.window.to')}>
              <Input
                mono
                value={draft.window.to}
                onChange={(e) =>
                  draft.window && set({ window: { ...draft.window, to: e.target.value } })
                }
              />
            </Field>
          </div>
        )}
        <Field label={t('pipelinesEnvironments.dialog.versions')}>
          <Select
            value={draft.versionsAllowed}
            onChange={(e) =>
              set({ versionsAllowed: e.value === 'passed_previous' ? 'passed_previous' : 'any' })
            }
            options={[
              { value: 'any', label: t('pipelinesEnvironments.dialog.versionsAny') },
              { value: 'passed_previous', label: t('pipelinesEnvironments.dialog.versionsPassed') },
            ]}
          />
        </Field>
        <ActionError error={write.error ?? writes.remove.error} />
      </div>
    </Modal>
  );
}
