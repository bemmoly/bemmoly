import { useT } from '@bemmoly/core-web';
import { Button, EmptyState, Kbd, Select, Tooltip, useToast } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState } from 'react';
import { useScreenKeys } from '../../../hooks/use-screen-keys.ts';
import { useVariables, useVariableWrites } from '../../../hooks/use-variables.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { ActionError } from '../../../parts/action-error.tsx';
import { LoadError } from '../../../parts/load-error.tsx';
import { RowsSkeleton } from '../../../parts/rows-skeleton.tsx';
import { SIDE_CARD } from '../side-cards.tsx';
import { DeleteVariable } from './delete-variable.tsx';
import { rowsFor, type VariableRow } from './rows.ts';
import { VariableDialog, type VariableDialogMode } from './variable-dialog.tsx';
import { VariablesTable } from './variables-table.tsx';

const EVERY = '*';

/**
 * The Variables tab: what a deploy runs with, for every environment or one (`?env=`). Plain
 * values edit in place; a secret is set or replaced, never shown. N adds a variable.
 */
export function VariablesTab({
  application,
  environment,
  onEnvironment,
}: {
  application: string;
  environment: string | null;
  onEnvironment: (key: string | null) => void;
}) {
  const t = useT(pipelinesText);
  const toast = useToast();
  const variables = useVariables(application);
  const { set } = useVariableWrites(application);
  const [dialog, setDialog] = useState<VariableDialogMode | null>(null);
  const [deleting, setDeleting] = useState<VariableRow | null>(null);
  const data = variables.data;
  const shown = data?.environments.find((env) => env.key === environment) ?? null;
  const canChange = data?.canChange ?? false;
  useScreenKeys({ n: () => canChange && setDialog({ kind: 'add' }) });

  if (variables.isError) {
    return (
      <LoadError
        title={t('pipelines.variables.loadFailed')}
        error={variables.error}
        onRetry={() => void variables.refetch()}
      />
    );
  }
  const rows = data ? rowsFor(data.items, shown?.key ?? null) : [];
  const at = (row: VariableRow) => ({
    application,
    environment: row.variable.environment?.key ?? null,
    name: row.name,
  });
  const save = (row: VariableRow, value: string) => {
    const previous = row.variable.value;
    set.mutate(
      { at: at(row), body: { kind: 'plain', value } },
      {
        onSuccess: () =>
          toast.undo({
            title: t('pipelines.variables.saved', { name: row.name }),
            body: t('pipelines.variables.nextDeploy'),
            onUndo: () =>
              previous !== null &&
              set.mutate({ at: at(row), body: { kind: 'plain', value: previous } }),
          }),
      },
    );
  };
  const add = (
    <Button variant="primary" disabled={!canChange} onClick={() => setDialog({ kind: 'add' })}>
      <Icon name="plus" size={14} />
      {t('pipelines.variables.add')}
      <Kbd keys="N" variant="plain" className="ms-1 max-md:hidden" />
    </Button>
  );
  return (
    <section className={SIDE_CARD} aria-label={t('pipelines.application.tabVariables')}>
      <div className="flex flex-wrap items-center gap-3">
        <Select
          aria-label={t('pipelines.variables.showFor')}
          value={shown?.key ?? EVERY}
          options={[
            { value: EVERY, label: t('pipelines.variables.every') },
            ...(data?.environments ?? []).map((env) => ({ value: env.key, label: env.name })),
          ]}
          onChange={(event) => onEnvironment(event.value === EVERY ? null : event.value)}
          className="min-w-52"
        />
        <p className="min-w-0 flex-1 text-12 text-tx-3">
          {shown
            ? t('pipelines.variables.oneHint', { environment: shown.name })
            : t('pipelines.variables.everyHint')}
        </p>
        {canChange ? add : <Tooltip label={t('pipelines.variables.cannotChange')}>{add}</Tooltip>}
      </div>
      {variables.isPending ? (
        <RowsSkeleton columns={4} rows={3} />
      ) : (
        <VariablesTable
          rows={rows}
          environmentName={shown?.name ?? null}
          canChange={canChange}
          saving={set.isPending}
          onSave={save}
          onReplace={(row) => setDialog({ kind: 'replace', variable: row.variable })}
          onOverride={(row) => setDialog({ kind: 'override', variable: row.variable })}
          onDelete={setDeleting}
          empty={
            <EmptyState
              size="sm"
              icon={<Icon name="sliders" size={18} />}
              title={t('pipelines.variables.empty')}
              description={t('pipelines.variables.emptyHint')}
              headingLevel={3}
            />
          }
        />
      )}
      {!dialog && <ActionError error={set.error} />}
      <p className="text-12 text-tx-3">{t('pipelines.variables.storeNote')}</p>
      {dialog && (
        <VariableDialog
          application={application}
          environment={shown}
          mode={dialog}
          onClose={() => setDialog(null)}
        />
      )}
      <DeleteVariable
        application={application}
        row={deleting}
        environmentName={shown?.name ?? null}
        onClose={() => setDeleting(null)}
      />
    </section>
  );
}
