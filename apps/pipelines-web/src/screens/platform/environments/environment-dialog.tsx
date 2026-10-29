import { useT } from '@bemmoly/core-web';
import {
  deployRuntimeSchema,
  environmentClassSchema,
  type Environment,
} from '@bemmoly/module-pipelines/shared';
import {
  Button,
  Checkbox,
  Field,
  Input,
  Modal,
  SegmentedControl,
  Select,
  type SelectGroup,
} from '@bemmoly/ui';
import { useId, useState, type KeyboardEvent } from 'react';
import { useEnvironmentWrites } from '../../../hooks/use-environments.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { RUNTIME_NAME } from '../../../parts/runtime-words.ts';
import { ActionError } from '../../../parts/action-error.tsx';
import {
  accountById,
  changesOf,
  createBodyOf,
  draftOf,
  draftReady,
  keyOf,
  keyValid,
  NEW_DRAFT,
  protectionOf,
  regionOf,
  regionValid,
  type AccountGroup,
  type EnvironmentDraft,
} from './draft.ts';

const NONE = 'none';

/**
 * New environment, or Edit: a name, its key (from the name until typed; fixed once made), its
 * class, the project it deploys into and the region there. Prod starts protected and asking
 * for an approval, said in words beside the boxes that change it. Mounted per opening.
 */
export function EnvironmentDialog({
  environment,
  groups,
  onClose,
}: {
  /** The environment to edit; null for a new one. */
  environment: Environment | null;
  groups: readonly AccountGroup[];
  onClose: () => void;
}) {
  const t = useT(pipelinesText);
  const { create, update } = useEnvironmentWrites();
  const write = environment ? update : create;
  const [draft, setDraft] = useState<EnvironmentDraft>(
    environment ? draftOf(environment) : NEW_DRAFT,
  );
  const classLabel = useId();
  const set = (patch: Partial<EnvironmentDraft>) => setDraft((now) => ({ ...now, ...patch }));
  const fallback = accountById(groups, draft.accountId)?.region ?? null;
  const region = regionOf(draft, fallback);
  const protection = protectionOf(draft);
  const changes = environment ? changesOf(environment, draft) : null;
  const ready = draftReady(draft, fallback) && (!changes || Object.keys(changes).length > 0);
  const current = environment?.cloudAccount;
  const listed = accountById(groups, current?.id ?? null);
  const options: SelectGroup[] = [
    { label: '', options: [{ value: NONE, label: t('pipelines.environments.noProject') }] },
    // An environment keeps its project in the list even after that project stops being ready.
    ...(current && !listed
      ? [
          {
            label: t('pipelines.environments.projectNow'),
            options: [{ value: current.id, label: current.externalId, description: current.name }],
          },
        ]
      : []),
    ...groups.map((group) => ({
      label: group.connection,
      options: group.accounts.map((account) => ({
        value: account.id,
        label: account.externalId,
        ...(account.name !== account.externalId ? { description: account.name } : {}),
      })),
    })),
  ];
  const submit = () => {
    if (!ready || write.isPending) return;
    if (environment && changes) {
      update.mutate({ key: environment.key, body: changes }, { onSuccess: onClose });
    } else {
      create.mutate(createBodyOf(draft, fallback), { onSuccess: onClose });
    }
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      submit();
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={
        environment
          ? t('pipelines.environments.editTitle', { name: environment.name })
          : t('pipelines.environments.new')
      }
      description={environment ? undefined : t('pipelines.environments.newDescription')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('pipelines.common.cancel')}
          </Button>
          <Button variant="primary" disabled={!ready} loading={write.isPending} onClick={submit}>
            {environment ? t('pipelines.environments.save') : t('pipelines.environments.create')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5" onKeyDown={onKeyDown}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t('pipelines.environments.fieldName')}>
            <Input
              autoFocus
              value={draft.name}
              placeholder={t('pipelines.environments.nameExample')}
              onChange={(event) => set({ name: event.target.value })}
            />
          </Field>
          <Field
            label={t('pipelines.environments.key')}
            hint={
              environment
                ? t('pipelines.environments.keyFixed')
                : t('pipelines.environments.keyHint')
            }
            error={
              !environment && keyOf(draft) && !keyValid(draft)
                ? t('pipelines.environments.keyInvalid')
                : null
            }
          >
            <Input
              mono
              value={keyOf(draft)}
              readOnly={environment !== null}
              onChange={(event) => set({ key: event.target.value.toLowerCase() })}
            />
          </Field>
        </div>
        <div className="flex flex-col gap-1.5">
          <span id={classLabel} className="font-medium text-tx">
            {t('pipelines.environments.class')}
          </span>
          <SegmentedControl
            aria-labelledby={classLabel}
            value={draft.class}
            options={environmentClassSchema.options.map((value) => ({
              value,
              label: t(`pipelines.envClass.${value}`),
            }))}
            onChange={(value) => set({ class: value })}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            label={t('pipelines.environments.project')}
            hint={groups.length === 0 ? t('pipelines.environments.noReadyProjects') : undefined}
          >
            <Select
              searchable
              value={draft.accountId ?? NONE}
              groups={options}
              onChange={(event) => set({ accountId: event.value === NONE ? null : event.value })}
            />
          </Field>
          <Field
            label={t('pipelines.environments.region')}
            hint={
              fallback && draft.region === null
                ? t('pipelines.environments.regionFromConnection')
                : undefined
            }
            error={regionValid(region) ? null : t('pipelines.clouds.regionInvalid')}
          >
            <Input
              mono
              value={region}
              placeholder={t('pipelines.environments.regionExample')}
              onChange={(event) => set({ region: event.target.value.trim() })}
            />
          </Field>
        </div>
        <Field
          label={t('pipelines.runtimes.environmentDefault')}
          hint={t('pipelines.runtimes.environmentDefaultHint')}
        >
          <Select
            value={draft.defaultRuntime}
            options={deployRuntimeSchema.options.map((value) => ({
              value,
              label: t(RUNTIME_NAME[value]),
            }))}
            onChange={(event) => set({ defaultRuntime: deployRuntimeSchema.parse(event.value) })}
          />
        </Field>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-medium text-tx">
            {t('pipelines.environments.protection')}
          </legend>
          {draft.class === 'prod' && draft.protection === null && (
            <p className="text-12 text-tx-2">{t('pipelines.environments.prodDefault')}</p>
          )}
          <Checkbox
            checked={protection.protected}
            label={t('pipelines.environments.protectedBox')}
            description={t('pipelines.environments.protectedHint')}
            onChange={(event) =>
              set({ protection: { ...protection, protected: event.target.checked } })
            }
          />
          <Checkbox
            checked={protection.requiresApproval}
            label={t('pipelines.environments.approvalBox')}
            description={t('pipelines.environments.approvalHint')}
            onChange={(event) =>
              set({ protection: { ...protection, requiresApproval: event.target.checked } })
            }
          />
        </fieldset>
        <ActionError error={write.error} />
      </div>
    </Modal>
  );
}
