import { useT } from '@bemmoly/core-web';
import type { EnvironmentRef, Variable, VariableKind } from '@bemmoly/module-pipelines/shared';
import { Button, Field, Input, Modal, SegmentedControl, Textarea, useToast } from '@bemmoly/ui';
import { useId, useState, type KeyboardEvent } from 'react';
import { useVariableWrites } from '../../../hooks/use-variables.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { ActionError } from '../../../parts/action-error.tsx';
import { nameOf, nameValid } from './rows.ts';

/** Add a variable, replace a secret's value, or give one environment its own value. */
export type VariableDialogMode =
  | { kind: 'add' }
  | { kind: 'replace'; variable: Variable }
  | { kind: 'override'; variable: Variable };

/**
 * A name, plain or secret, and a value, for the environment the tab shows (or every one). A
 * secret's value is shown while it is typed, so a pasted key can be checked, and never again:
 * it goes to the secret store and the answer carries its version only. Mounted per opening.
 */
export function VariableDialog({
  application,
  environment,
  mode,
  onClose,
}: {
  application: string;
  environment: EnvironmentRef | null;
  mode: VariableDialogMode;
  onClose: () => void;
}) {
  const t = useT(pipelinesText);
  const toast = useToast();
  const { set } = useVariableWrites(application);
  const fixed = mode.kind === 'add' ? null : mode.variable;
  const [name, setName] = useState(fixed?.name ?? '');
  const [kind, setKind] = useState<VariableKind>(fixed?.kind ?? 'plain');
  const [value, setValue] = useState(
    mode.kind === 'override' && mode.variable.kind === 'plain' ? (mode.variable.value ?? '') : '',
  );
  const kindLabel = useId();
  const ready = nameValid(name) && value.length > 0;
  const where = environment
    ? t('pipelines.variables.forOne', { environment: environment.name })
    : t('pipelines.variables.forEvery');
  const submit = () => {
    if (!ready || set.isPending) return;
    set.mutate(
      {
        at: { application, environment: environment?.key ?? null, name },
        body: { kind, value },
      },
      {
        onSuccess: (saved) => {
          if (saved.kind === 'secret') {
            toast.show({
              title: t('pipelines.variables.secretSaved', {
                name: saved.name,
                version: saved.version ?? 0,
              }),
              body: t('pipelines.variables.nextDeploy'),
            });
          }
          onClose();
        },
      },
    );
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      submit();
    }
  };
  const title =
    mode.kind === 'replace'
      ? t('pipelines.variables.replaceTitle', { name })
      : mode.kind === 'override'
        ? t('pipelines.variables.overrideTitle', { name, environment: environment?.name ?? '' })
        : t('pipelines.variables.addTitle');
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      description={where}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('pipelines.common.cancel')}
          </Button>
          <Button variant="primary" disabled={!ready} loading={set.isPending} onClick={submit}>
            {mode.kind === 'replace'
              ? t('pipelines.variables.replace')
              : t('pipelines.variables.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5" onKeyDown={onKeyDown}>
        <Field
          label={t('pipelines.variables.name')}
          hint={fixed ? undefined : t('pipelines.variables.nameHint')}
          error={name && !nameValid(name) ? t('pipelines.variables.nameInvalid') : null}
        >
          <Input
            mono
            autoFocus={!fixed}
            readOnly={fixed !== null}
            value={name}
            placeholder={t('pipelines.variables.nameExample')}
            onChange={(event) => setName(nameOf(event.target.value))}
          />
        </Field>
        {mode.kind === 'add' && (
          <div className="flex flex-col gap-1.5">
            <span id={kindLabel} className="font-medium text-tx">
              {t('pipelines.variables.kind')}
            </span>
            <SegmentedControl
              aria-labelledby={kindLabel}
              value={kind}
              options={[
                { value: 'plain', label: t('pipelines.variables.kindPlain') },
                { value: 'secret', label: t('pipelines.variables.kindSecret') },
              ]}
              onChange={(next) => setKind(next)}
            />
          </div>
        )}
        <Field
          label={t('pipelines.variables.value')}
          hint={
            kind === 'secret'
              ? t('pipelines.variables.secretHint')
              : t('pipelines.variables.plainHint')
          }
        >
          {kind === 'secret' ? (
            <Textarea
              autoFocus={fixed !== null}
              value={value}
              rows={3}
              spellCheck={false}
              autoComplete="off"
              className="font-mono"
              onChange={(event) => setValue(event.target.value)}
            />
          ) : (
            <Input
              mono
              autoFocus={fixed !== null}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          )}
        </Field>
        <ActionError error={set.error} />
      </div>
    </Modal>
  );
}
